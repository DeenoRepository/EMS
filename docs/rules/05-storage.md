# Storage

> **Версия:** 2.4.0
> **Обновлено:** 2026-08-13 — добавлены секции по Redis, LDAP, HTTPS, OpenTelemetry  
> **Расположение кода:** [`src/lib/storage/`](../../src/lib/storage/)

---

## 1. Обзор

EMS использует **абстракцию хранилища** с поддержкой двух провайдеров:

1. **Local Storage** — для разработки и standalone-режима
2. **S3 / MinIO** — для production

Автоматический выбор провайдера на основе переменных окружения.

```
┌─────────────────────────────────────────────────────────────┐
│                    Storage Abstraction                      │
│                                                             │
│  ┌─────────────────┐      ┌─────────────────┐               │
│  │  Local Provider │      │  S3 Provider    │               │
│  │  (filesystem)   │      │  (MinIO/AWS S3) │               │
│  └─────────────────┘      └─────────────────┘               │
│           ↑                        ↑                         │
│           └────────────┬───────────┘                         │
│                        ↓                                     │
│              ┌─────────────────┐                             │
│              │ Secure Provider │                             │
│              │  (validation)   │                             │
│              └─────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Конфигурация

### 2.1. Переменные окружения

```bash
# S3 / MinIO (если все 4 заданы — используется S3, иначе Local)
S3_ENDPOINT=http://minio:9000
S3_BUCKET=ems-documents
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin

# Local Storage (fallback)
LOCAL_STORAGE_DIR=/app/uploads
```

### 2.2. Логика выбора

```typescript
// src/lib/storage/s3.ts
const s3Endpoint = process.env.S3_ENDPOINT;
const s3Bucket = process.env.S3_BUCKET;
const s3AccessKey = process.env.S3_ACCESS_KEY;
const s3SecretKey = process.env.S3_SECRET_KEY;

if (s3Endpoint && s3Bucket && s3AccessKey && s3SecretKey) {
  // Используется S3
} else {
  // Fallback на Local
}
```

---

## 3. Local Provider ([`src/lib/storage/provider.ts`](../../src/lib/storage/provider.ts))

### 3.1. Назначение

Хранение файлов на локальной файловой системе. Используется для:
- Разработки без внешних зависимостей
- Standalone-режима Docker
- Fallback при недоступности S3

### 3.2. Структура хранения

```
data/uploads/
├── 2026/
│   ├── 01/
│   │   ├── uuid-filename1.pdf
│   │   └── uuid-filename2.docx
│   ├── 02/
│   └── ...
└── 2026/
    └── ...
```

**Формат пути:** `{year}/{month}/{uuid}-{sanitized-filename}`

### 3.3. API

#### `storeLocalFile(input)`

```typescript
import { storeLocalFile } from "@/lib/storage/provider";

const result = await storeLocalFile({
  fileName: "document.pdf",
  mimeType: "application/pdf",
  bytes: buffer
});

// result = {
//   fileName: "document.pdf",
//   storagePath: "local://2026/01/uuid-document.pdf",
//   checksum: "sha256-hash"
// }
```

#### `readLocalStoredFile(storagePath)`

```typescript
import { readLocalStoredFile } from "@/lib/storage/provider";

const { bytes, fileName } = await readLocalStoredFile(
  "local://2026/01/uuid-document.pdf"
);
```

### 3.4. Безопасность

#### Whitelist MIME-типов

```typescript
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "text/plain"
]);
```

#### Ограничение размера

```typescript
const maxBytes = 20 * 1024 * 1024; // 20 MB
```

#### Path Traversal Protection

```typescript
function safeRelativePath(value: string) {
  const normalized = normalize(value).replace(/^([/\\])+/, "");
  if (normalized.includes("..")) {
    throw new Error("Invalid storage path");
  }
  return normalized;
}
```

#### Sanitization имени файла

```typescript
const storedName = `${randomUUID()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
```

---

## 4. S3 Provider ([`src/lib/storage/s3.ts`](../../src/lib/storage/s3.ts))

### 4.1. Назначение

Хранение файлов в S3-совместимом хранилище (MinIO, AWS S3, Yandex Object Storage).

### 4.2. API

#### `uploadDocumentFile(options)`

```typescript
import { uploadDocumentFile } from "@/lib/storage/s3";

const result = await uploadDocumentFile({
  fileName: "document.pdf",
  buffer: fileBuffer,
  contentType: "application/pdf",
  folder: "documents"  // опционально
});

// result = {
//   storagePath: "s3://ems-documents/documents/1234567890_abc12345_document.pdf",
//   checksum: "sha256-hash",
//   fileSize: 1024000,
//   url: "http://minio:9000/ems-documents/documents/..."
// }
```

#### `generateSignedDownloadUrl(storagePath, expiresInSeconds)`

```typescript
import { generateSignedDownloadUrl } from "@/lib/storage/s3";

const url = generateSignedDownloadUrl(
  "s3://ems-documents/documents/file.pdf",
  3600  // 1 час
);
// "http://minio:9000/ems-documents/documents/file.pdf?expires=...&sig=..."
```

### 4.3. Формат storagePath

```
s3://{bucket}/{folder}/{timestamp}_{checksum-prefix}_{filename}
```

Пример: `s3://ems-documents/documents/1704067200_a1b2c3d4_document.pdf`

### 4.4. Checksum

SHA-256 хэш вычисляется для каждого файла:

```typescript
import crypto from "crypto";

export function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
```

---

## 5. Secure Provider ([`src/lib/storage/secure-provider.ts`](../../src/lib/storage/secure-provider.ts))

### 5.1. Назначение

Обёртка над базовыми провайдерами с дополнительными проверками безопасности:
- Валидация MIME-типа
- Проверка размера
- Sanitization имени файла
- Проверка magic bytes (опционально)

### 5.2. Использование

```typescript
import { secureStoreFile } from "@/lib/storage/secure-provider";

const result = await secureStoreFile({
  fileName: "document.pdf",
  mimeType: "application/pdf",
  bytes: buffer
});
```

---

## 6. Validation ([`src/lib/storage/validation.ts`](../../src/lib/storage/validation.ts))

### 6.1. Назначение

Централизованная валидация файлов перед сохранением.

### 6.2. Правила

```typescript
// Максимальный размер
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Разрешённые MIME-типы
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "text/plain"
];

// Запрещённые расширения
const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".sh", ".ps1",
  ".js", ".vbs", ".jar", ".msi"
];
```

---

## 7. Использование в модулях

### 7.1. Загрузка документа (EPS)

```typescript
// src/app/api/modules/eps/documents/upload/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { uploadDocumentFile } from "@/lib/storage/s3";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/telemetry/logger";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  
  if (!hasPermission(session, "eps.documents.manage")) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }
  
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const documentId = formData.get("documentId") as string;
  
  if (!file || !documentId) {
    return NextResponse.json({ error: "Не указаны обязательные поля" }, { status: 400 });
  }
  
  // Валидация
  if (file.size > **Версия:** 2.4.0
> 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Файл слишком большой" }, { status: 400 });
  }
  
  const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Неподдерживаемый тип файла" }, { status: 400 });
  }
  
  // Загрузка
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadDocumentFile({
    fileName: file.name,
    buffer,
    contentType: file.type,
    folder: `documents/${documentId}`
  });
  
  // Сохранение версии документа
  const version = await prisma.documentVersion.create({
    data: {
      documentId,
      versionNumber: await getNextVersionNumber(documentId),
      fileName: file.name,
      storagePath: result.storagePath,
      checksum: result.checksum,
      createdById: session.id
    }
  });
  
  // Audit log
  logEvent({
    level: "audit",
    module: "EPS",
    action: "DOCUMENT_UPLOADED",
    userId: session.id,
    details: { documentId, versionId: version.id, fileName: file.name }
  });
  
  return NextResponse.json({ success: true, version });
}
```

### 7.2. Скачивание документа

```typescript
// src/app/api/modules/eps/documents/download/route.ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { readLocalStoredFile } from "@/lib/storage/provider";
import { generateSignedDownloadUrl } from "@/lib/storage/s3";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Необходима авторизация" }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get("versionId");
  
  if (!versionId) {
    return NextResponse.json({ error: "Не указан versionId" }, { status: 400 });
  }
  
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId }
  });
  
  if (!version) {
    return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
  }
  
  // Для S3 — редирект на signed URL
  if (version.storagePath.startsWith("s3://")) {
    const url = generateSignedDownloadUrl(version.storagePath, 3600);
    return NextResponse.redirect(url);
  }
  
  // Для Local — отдаём файл
  if (version.storagePath.startsWith("local://")) {
    const { bytes, fileName } = await readLocalStoredFile(version.storagePath);
    
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": bytes.length.toString()
      }
    });
  }
  
  return NextResponse.json({ error: "Неподдерживаемый протокол" }, { status: 400 });
}
```

---

## 8. Модель данных

### 8.1. Document

```prisma
model Document {
  id          String          @id @default(cuid())
  equipmentId String
  title       String
  docType     DocumentType
  status      DocumentStatus  @default(DRAFT)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  versions    DocumentVersion[]
  equipment   Equipment       @relation(fields: [equipmentId], references: [id], onDelete: Cascade)
  
  @@index([equipmentId])
  @@index([status])
}
```

### 8.2. DocumentVersion

```prisma
model DocumentVersion {
  id            String   @id @default(cuid())
  documentId    String
  versionNumber Int
  fileName      String
  storagePath   String   // "local://..." или "s3://..."
  checksum      String   // SHA-256
  notes         String?
  metadata      Json?
  createdAt     DateTime @default(now())
  createdById   String
  
  document  Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  createdBy User     @relation("DocVersionAuthor", fields: [createdById], references: [id])
  
  @@unique([documentId, versionNumber])
  @@index([createdAt])
}
```

---

## 9. Docker конфигурация

### 9.1. MinIO (docker-compose.yml)

```yaml
minio:
  image: minio/minio:RELEASE.2024-01-16T16-07-38Z
  container_name: ems-minio
  restart: always
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${S3_ACCESS_KEY}
    MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY}
  ports:
    - "9000:9000"
    - "9001:9001"  # Console
  volumes:
    - minio_data:/data
  healthcheck:
    test: ["CMD-SHELL", "mc ready local"]
    interval: 5s
    timeout: 5s
    retries: 5
```

### 9.2. Создание bucket

```bash
# Через mc (MinIO Client)
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/ems-documents
```

---

## 10. Лучшие практики

✅ **Делать:**
- Использовать `uploadDocumentFile()` для всех загрузок
- Вычислять checksum для контроля целостности
- Валидировать MIME-тип и размер перед загрузкой
- Использовать signed URLs с ограниченным TTL
- Логировать все операции через `logEvent()`
- Хранить `storagePath` в БД, а не сам файл

❌ **Не делать:**
- Не хранить файлы в БД (только метаданные)
- Не использовать публичные URL без подписи
- Не доверять MIME-типу из заголовка (проверять magic bytes)
- Не сохранять файлы без checksum
- Не использовать пути из пользовательского ввода напрямую

---

## 11. Миграция между провайдерами

Для миграции с Local на S3:

```typescript
// scripts/migrate-storage.ts
import { prisma } from "@/lib/db/prisma";
import { readLocalStoredFile } from "@/lib/storage/provider";
import { uploadDocumentFile } from "@/lib/storage/s3";

async function migrateToS3() {
  const versions = await prisma.documentVersion.findMany({
    where: { storagePath: { startsWith: "local://" } }
  });
  
  for (const version of versions) {
    const { bytes, fileName } = await readLocalStoredFile(version.storagePath);
    
    const result = await uploadDocumentFile({
      fileName,
      buffer: bytes,
      folder: "migrated"
    });
    
    await prisma.documentVersion.update({
      where: { id: version.id },
      data: { storagePath: result.storagePath }
    });
    
    console.log(`Migrated: ${version.id}`);
  }
}
```
