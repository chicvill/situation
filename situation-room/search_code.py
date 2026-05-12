import os

targets = ["save_staff", "/api/staff/register", "table_staff_accounts", "PersonalInfos"]
results = []

for root, dirs, files in os.walk("."):
    if ".git" in dirs:
        dirs.remove(".git")
    for file in files:
        if file.endswith((".py", ".tsx", ".ts", ".js", ".json")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                    for target in targets:
                        if target in content:
                            results.append(f"Found '{target}' in {path}")
            except Exception as e:
                pass

with open("search_results.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(set(results)))

print("Done")
