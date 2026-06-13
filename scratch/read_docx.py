import zipfile
import xml.etree.ElementTree as ET

def read_docx(file_path):
    with zipfile.ZipFile(file_path) as docx:
        xml_content = docx.read('word/document.xml')
        root = ET.fromstring(xml_content)
        
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        
        paragraphs = []
        for paragraph in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
            texts = []
            for text_elem in paragraph.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
                if text_elem.text:
                    texts.append(text_elem.text)
            if texts:
                paragraphs.append(''.join(texts))
            else:
                paragraphs.append('')
        return '\n'.join(paragraphs)

if __name__ == '__main__':
    content = read_docx('../store_owner_manual.docx')
    with open('docx_content.txt', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully wrote docx content to docx_content.txt")
