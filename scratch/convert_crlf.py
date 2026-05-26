import glob

for f in glob.glob("*.bat"):
    print(f"Converting line endings for: {f}")
    with open(f, "rb") as file:
        content = file.read()
    
    # Normalise to LF first, then convert all LF to CRLF
    normalized = content.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    
    with open(f, "wb") as file:
        file.write(normalized)

print("All batch files successfully converted to CRLF line endings!")
