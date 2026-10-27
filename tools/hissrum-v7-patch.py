from pathlib import Path
import runpy

source = Path('games/hissrum-strike/src/fps/game.mjs')
if 'automaticTrigger' in source.read_text():
    print('Integration already applied; verification will still run.')
else:
    for name in ('engine', 'ui', 'client', 'qa'):
        script = Path('tools/hissrum-v7-integration') / (name + '.py')
        print('Applying', script, flush=True)
        runpy.run_path(str(script), run_name='__main__')
    print('Hissrum v7 integration complete; run Node and browser checks.')
