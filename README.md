# Cost Manager - RESTful Web Services
## מטלה סופית - פיתוח צד שרת אסינכרוני

### מבנה הפרויקט
```
costmanager/
├── logs-service/      Process A - GET /api/logs
├── users-service/     Process B - users endpoints
├── costs-service/     Process C - costs + report
├── about-service/     Process D - GET /api/about
└── test_costmanager.py
```

### התקנה והרצה

#### שלב 1 - MongoDB Atlas
1. היכנס ל-https://www.mongodb.com/atlas
2. צור Cluster חינמי (M0)
3. צור משתמש DB
4. אפשר גישה מ-0.0.0.0/0
5. העתק את ה-Connection String

#### שלב 2 - עדכן .env בכל שירות
החלף `YOUR_USERNAME:YOUR_PASSWORD@cluster0.xxxxx` עם ה-Connection String האמיתי שלך.

#### שלב 3 - התקן dependencies
```bash
cd logs-service   && npm install
cd ../users-service  && npm install
cd ../costs-service  && npm install
cd ../about-service  && npm install
```

#### שלב 4 - הוסף את המשתמש הדמיוני
שלח POST ל-users-service:
```json
POST http://localhost:3002/api/add
{
  "id": 123123,
  "first_name": "mosh",
  "last_name": "israeli",
  "birthday": "1990-01-01"
}
```

#### שלב 5 - הרץ את השירותים (4 טרמינלים)
```bash
# טרמינל 1
cd logs-service && node app.js

# טרמינל 2
cd users-service && node app.js

# טרמינל 3
cd costs-service && node app.js

# טרמינל 4
cd about-service && node app.js
```

#### שלב 6 - הרץ את הטסטים
```bash
pip install pytest requests
pytest test_costmanager.py -v
```

### Endpoints

| Process | Port | Endpoint | Method |
|---------|------|----------|--------|
| A - logs | 3001 | /api/logs | GET |
| B - users | 3002 | /api/users | GET |
| B - users | 3002 | /api/users/:id | GET |
| B - users | 3002 | /api/add | POST |
| C - costs | 3003 | /api/add | POST |
| C - costs | 3003 | /api/report | GET |
| D - about | 3004 | /api/about | GET |
