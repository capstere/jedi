from pathlib import Path
import base64,json
p=Path(__file__).resolve().parents[1]
s=(p/'source/template.html').read_text()
replacements={
 '__TRIANGLES__':f"{json.loads((p/'source/model_manifest.json').read_text())['modelTriangles']:,}".replace(',', ' '),
 '__CSS__':(p/'source/styles.css').read_text()+'\n'+(p/'source/planner.css').read_text()+'\n'+(p/'source/simulation.css').read_text(),
 '__APP__':(p/'source/app.js').read_text(),
 '__CORE__':'\n'.join((p/'source'/name).read_text() for name in ['planner-core.js','cartridge-mesh.js','object-library.js','studio-core.js','floor-tape.js','door.js','elevator.js','simulation-core.js','npc-assets.js','npc-renderer.js']),
 '__PLANNER__':(p/'source/planner.js').read_text()+'\n'+(p/'source/simulation-ui.js').read_text()+'\n'+(p/'source/simulation-modes.js').read_text(),
 '__INFO__':(p/'source/model_manifest.json').read_text(),
 '__GLB__':base64.b64encode((p/'model/Hissrum12_REKONSTRUERAT_V2.glb').read_bytes()).decode()
}
for a,b in replacements.items():s=s.replace(a,b)
out=p/'STARTA_HISSRUM_12_V5.html'
out.write_text(s,encoding='utf-8')
print(f'Built {out.name}: {out.stat().st_size:,} bytes')
