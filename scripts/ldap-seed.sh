#!/bin/sh
# LDAP seed script - creates test users and groups for EMS

LDAP_HOST="${LDAP_HOST:-ldap}"
LDAP_PORT="${LDAP_PORT:-389}"
ADMIN_DN="cn=admin,dc=ems,dc=local"
ADMIN_PW="${LDAP_ADMIN_PASSWORD:-admin}"

BASE_DN="dc=ems,dc=local"
PEOPLE_DN="ou=people,${BASE_DN}"
GROUPS_DN="ou=groups,${BASE_DN}"

echo "Seeding LDAP..."

# Create OUs (ignore if exist)
ldapadd -c -x -H ldap://${LDAP_HOST}:${LDAP_PORT} -D "${ADMIN_DN}" -w "${ADMIN_PW}" <<EOF
dn: ou=people,${BASE_DN}
objectClass: organizationalUnit
ou: people

dn: ou=groups,${BASE_DN}
objectClass: organizationalUnit
ou: groups
EOF

# Create users (ignore if exist)
ldapadd -c -x -H ldap://${LDAP_HOST}:${LDAP_PORT} -D "${ADMIN_DN}" -w "${ADMIN_PW}" <<EOF
dn: uid=admin,${PEOPLE_DN}
objectClass: inetOrgPerson
uid: admin
cn: Admin User
sn: Admin
mail: admin@ems.local
userPassword: admin123

dn: uid=editor,${PEOPLE_DN}
objectClass: inetOrgPerson
uid: editor
cn: Editor User
sn: Editor
mail: editor@ems.local
userPassword: editor123

dn: uid=viewer,${PEOPLE_DN}
objectClass: inetOrgPerson
uid: viewer
cn: Viewer User
sn: Viewer
mail: viewer@ems.local
userPassword: viewer123
EOF

# Create groups (ignore if exist)
ldapadd -c -x -H ldap://${LDAP_HOST}:${LDAP_PORT} -D "${ADMIN_DN}" -w "${ADMIN_PW}" <<EOF
dn: cn=DEPS_Admins,${GROUPS_DN}
objectClass: groupOfNames
cn: DEPS_Admins
member: uid=admin,${PEOPLE_DN}

dn: cn=DEPS_Editors,${GROUPS_DN}
objectClass: groupOfNames
cn: DEPS_Editors
member: uid=editor,${PEOPLE_DN}

dn: cn=DEPS_Viewers,${GROUPS_DN}
objectClass: groupOfNames
cn: DEPS_Viewers
member: uid=viewer,${PEOPLE_DN}
EOF

echo "LDAP seed complete."
echo "Users:"
echo "  admin / admin123   (DEPS_Admins)"
echo "  editor / editor123 (DEPS_Editors)"
echo "  viewer / viewer123 (DEPS_Viewers)"
