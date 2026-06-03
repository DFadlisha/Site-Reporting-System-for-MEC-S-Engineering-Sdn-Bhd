# 📁 SPRS Excel Import Folder

Place your separate Excel files in this directory to import them into the SPRS Firebase Firestore database.

### 📄 Expected File Names:
* **`projects.xlsx`** (Project lists)
* **`tasks.xlsx`** (Task schedules)
* **`issues.xlsx`** (Site issues list)
* **`site_reports.xlsx`** or **`reports.xlsx`** (Daily site reports)
* **`users.xlsx`** (System users)

Or, you can place a single consolidated **`data.xlsx`** file containing sheets named `Projects`, `Tasks`, `Users`, `Issues`, and `Reports` here.

### 🚀 Running the Import:
Run the script from your project root:
```bash
node scripts/importExcel.js
```
