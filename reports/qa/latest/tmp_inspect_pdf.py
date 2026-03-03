import re,sys
from pathlib import Path
pdf=Path(r"o:\\Descargas\\evaluapro_paquete_examenes_materia-Logica_de_Programacion_plantilla-Primer_Parcial_total-15_lote-A050929D.pdf")
print('EXISTS', pdf.exists(), 'SIZE', pdf.stat().st_size if pdf.exists() else -1)
if not pdf.exists():
    raise SystemExit(0)
try:
    import pypdf
except Exception as e:
    print('NO_PYPDF', e)
    raise SystemExit(0)
reader=pypdf.PdfReader(str(pdf))
print('PAGES', len(reader.pages))
folios=set()
for i,p in enumerate(reader.pages, start=1):
    t=(p.extract_text() or '')
    for m in re.finditer(r'EXAMEN:([A-Z0-9]{8}):P(\d+):TV(\d+)', t):
        folios.add(m.group(1))
    if i<=2:
        print('---PAGE', i)
        print(t[:800].replace('\n',' | '))
print('FOLIOS_QR_FOUND', len(folios))
print('FOLIOS_SAMPLE', sorted(folios)[:10])
