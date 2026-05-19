param(
  [string]$ContainerName = "ems-ldap-local",
  [string]$AdminDn = "cn=admin,dc=ems,dc=local",
  [string]$AdminPassword = "admin",
  [string]$AdminUserPassword = "admin123",
  [string]$EditorUserPassword = "editor123",
  [string]$ViewerUserPassword = "viewer123"
)

$ErrorActionPreference = "Stop"

$tmpDir = Join-Path $env:TEMP "ems-ldap-seed"
if (-not (Test-Path -LiteralPath $tmpDir)) {
  New-Item -ItemType Directory -Path $tmpDir | Out-Null
}

$ldifPath = Join-Path $tmpDir "seed.ldif"
$ldif = @"
dn: ou=people,dc=ems,dc=local
objectClass: organizationalUnit
ou: people

dn: ou=groups,dc=ems,dc=local
objectClass: organizationalUnit
ou: groups

dn: uid=admin,ou=people,dc=ems,dc=local
objectClass: inetOrgPerson
objectClass: top
cn: EMS Admin
sn: Admin
uid: admin
mail: admin@local
userPassword: admin123

dn: uid=editor,ou=people,dc=ems,dc=local
objectClass: inetOrgPerson
objectClass: top
cn: EMS Editor
sn: Editor
uid: editor
mail: editor@local
userPassword: editor123

dn: uid=viewer,ou=people,dc=ems,dc=local
objectClass: inetOrgPerson
objectClass: top
cn: EMS Viewer
sn: Viewer
uid: viewer
mail: viewer@local
userPassword: viewer123

dn: cn=DEPS_Admins,ou=groups,dc=ems,dc=local
objectClass: groupOfNames
objectClass: top
cn: DEPS_Admins
member: uid=admin,ou=people,dc=ems,dc=local

dn: cn=DEPS_Editors,ou=groups,dc=ems,dc=local
objectClass: groupOfNames
objectClass: top
cn: DEPS_Editors
member: uid=editor,ou=people,dc=ems,dc=local

dn: cn=DEPS_Viewers,ou=groups,dc=ems,dc=local
objectClass: groupOfNames
objectClass: top
cn: DEPS_Viewers
member: uid=viewer,ou=people,dc=ems,dc=local
"@

$ldif = $ldif.Replace("admin123", $AdminUserPassword).Replace("editor123", $EditorUserPassword).Replace("viewer123", $ViewerUserPassword)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($ldifPath, $ldif, $utf8NoBom)

docker cp $ldifPath "${ContainerName}:/tmp/seed.ldif" | Out-Null
docker exec $ContainerName sh -lc "ldapadd -c -x -H ldap://localhost:389 -D '$AdminDn' -w '$AdminPassword' -f /tmp/seed.ldif >/tmp/seed.log 2>&1; cat /tmp/seed.log; rm -f /tmp/seed.ldif /tmp/seed.log"

Write-Host "[EMS] LDAP seed completed (idempotent)." -ForegroundColor Green
