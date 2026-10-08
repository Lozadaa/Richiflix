from pathlib import Path
import json, subprocess, xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parent
# Lettering original, construido con contornos; no se carga ninguna fuente.
GLYPHS={
'K':(52,'M0 0H10V31L37 0H50L21 34L52 72H39L10 37V72H0Z'),
'i':(12,'M1 0H11V11H1ZM1 22H11V72H1Z'),
'n':(48,'M0 22H10V28Q17 20 28 20Q46 20 46 40V72H36V41Q36 30 26 30Q10 30 10 44V72H0Z'),
'g':(50,'M38 22H48V71Q48 94 24 94Q11 94 3 88L8 80Q15 85 24 85Q38 85 38 72V67Q31 74 22 74Q0 74 0 47Q0 20 22 20Q31 20 38 27ZM10 47Q10 64 24 64Q38 64 38 47Q38 30 24 30Q10 30 10 47Z'),
'd':(50,'M38 0H48V72H38V66Q31 74 22 74Q0 74 0 47Q0 20 22 20Q31 20 38 27ZM10 47Q10 64 24 64Q38 64 38 47Q38 30 24 30Q10 30 10 47Z'),
'o':(48,'M24 20Q48 20 48 47Q48 74 24 74Q0 74 0 47Q0 20 24 20ZM10 47Q10 64 24 64Q38 64 38 47Q38 30 24 30Q10 30 10 47Z'),
'm':(76,'M0 22H10V28Q16 20 25 20Q36 20 41 29Q48 20 59 20Q76 20 76 40V72H66V41Q66 30 57 30Q44 30 44 44V72H34V41Q34 30 25 30Q10 30 10 44V72H0Z'),
'P':(49,'M0 0H24Q49 0 49 23Q49 46 24 46H10V72H0ZM10 10V36H24Q39 36 39 23Q39 10 24 10Z'),
'l':(12,'M1 0H11V72H1Z'),
'a':(48,'M22 20Q46 20 46 39V72H36V66Q29 74 18 74Q0 74 0 58Q0 41 24 41H36V39Q36 30 22 30Q12 30 5 35L2 26Q11 20 22 20ZM36 49H24Q10 49 10 58Q10 65 20 65Q36 65 36 52Z'),
'y':(49,'M0 22H11L25 59L38 22H49L25 83Q21 94 7 94H2V84H7Q14 84 17 76L19 71Z'),
'e':(48,'M47 50H10Q12 65 26 65Q35 65 42 60L47 68Q38 74 26 74Q0 74 0 47Q0 20 24 20Q48 20 48 45ZM10 41H38Q36 29 24 29Q13 29 10 41Z'),
'r':(31,'M0 22H10V30Q17 20 30 20V31Q10 30 10 47V72H0Z')}
PROPOSALS=[
{'id':'01-almena','name':'Almena','idea':'Una almena escalonada con tres alturas asimétricas. La base continua hace reconocible la silueta en un solo vistazo; sin joyas, escudos ni play recortado.','geometry':'M3 13H7V8H11V4H17V8H21V11H25V7H29V25H3Z','base':'M3 27H29V29H3Z','palette':['#10191c','#819394','#f2f3ed','#a8b8b6','#b5c6b8','#b8ceff'],'kids':'#f0bb82','track':6,'scale':1},
{'id':'02-umbral','name':'Umbral','idea':'Un portal de reino con cubierta escalonada y abertura ancha. El vacío central representa entrada y biblioteca; el remate lateral evita la simetría de una corona convencional.','geometry':'M3 28V10H9V6H15V3H21V8H29V28H21V15H11V28Z','base':'M13 26H19V29H13Z','palette':['#15171e','#8d909e','#f5f1ed','#b9b5c2','#c4c0ce','#9fd9c7'],'kids':'#f4be8b','track':8,'scale':0.94},
{'id':'03-corona-abierta','name':'Corona abierta','idea':'Una corona horizontal de dos puntas con un corte ancho en el centro. El centro abierto aligera el signo y deja dos volúmenes enlazados por una base neutra.','geometry':'M3 8L11 14L14 5V24H6ZM18 5L21 14L29 8L26 24H18Z','base':'M6 26H26V29H6Z','palette':['#191815','#969083','#f6f3e9','#c0b9a9','#c9c4b4','#a9d2ef'],'kids':'#f1b58c','track':5,'scale':1.03}]
TOKENS=['fondo','superficie','texto','texto-secundario','acento','foco']
def lum(c):
    rgb=[int(c[i:i+2],16)/255 for i in (1,3,5)]
    return sum(w*(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for w,v in zip((.2126,.7152,.0722),rgb))
def contrast(a,b):
    a,b=sorted((lum(a),lum(b)))
    return (b+.05)/(a+.05)
def letters(word,track):
    x=0; out=[]
    for ch in word:
        if ch==' ': x+=24; continue
        width,path=GLYPHS[ch]
        out.append(f'<path transform="translate({x} 0)" d="{path}"/>'); x+=width+track
    return ''.join(out),x-track

def svg(label,view,body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" role="img" aria-label="{label}">{body}</svg>'
def symbol(p):
    return svg('Símbolo Kingdom — '+p['name'],'0 0 32 32',f'<path fill="{p["palette"][4]}" d="{p["geometry"]}"/><path fill="{p["palette"][2]}" d="{p["base"]}"/>')
def wordmark(p,player=False):
    paths,width=letters('Kingdom',p['track']); width*=p['scale']
    content=f'<g fill="{p["palette"][2]}" fill-rule="evenodd" transform="translate(0 4) scale({p["scale"]} 1)">{paths}</g>'
    if player:
        playerpaths,pw=letters('Player',6)
        content+=f'<g fill="{p["palette"][4]}" fill-rule="evenodd" transform="translate({width+24} 40) scale(.5)">{playerpaths}</g>'
        width+=24+pw*.5
    return svg('Kingdom Player' if player else 'Kingdom',f'0 0 {width:g} 102',content)
def assets(p):
    directory=ROOT/p['id']; directory.mkdir(exist_ok=True)
    for filename,body in [('simbolo.svg',symbol(p)),('kingdom.svg',wordmark(p)),('kingdom-player.svg',wordmark(p,True))]:
        (directory/filename).write_text(body+'\n',encoding='utf-8')
    palette=dict(zip(TOKENS,p['palette']))
    data={'nombre':p['name'],'tokens':palette,'kids-acento':p['kids'],'contraste-sobre-fondo':{k:round(contrast(c,p['palette'][0]),4) for k,c in palette.items()},'kids-contraste-sobre-fondo':round(contrast(p['kids'],p['palette'][0]),4),'formula':'WCAG 2.x: (L mayor + 0.05) / (L menor + 0.05); sRGB linealizado; pesos 0.2126, 0.7152, 0.0722.'}
    (directory/'paleta.json').write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    (directory/'README.md').write_text(f'''# {p['name']}

{p['idea']}

El símbolo usa una cuadrícula de 32 unidades, un acento y una base neutra. Los detalles mínimos miden 2 unidades (1 px a 16 px). Mantener el margen del viewBox; no añadir trazos, sombras ni detalles. Sobre arte, usar una placa del token fondo: un póster arbitrario no garantiza contraste.

`simbolo.svg` es el símbolo sin texto; `kingdom.svg` es el lettering para interfaz; `kingdom-player.svg` se reserva para metadatos. Lettering geométrico original construido con contornos y curvas cuadráticas, sin fuentes, imágenes ni dependencias. No sustituye Bricolage Grotesque y Manrope en títulos y controles.

Los seis tokens y ratios están en `paleta.json`. Texto, texto secundario, acento, foco y superficie superan 4.5:1 sobre fondo. Fondo contra sí mismo es 1:1 y no es contenido. La superficie es clara deliberadamente: usar tinta del token fondo dentro de ella; los otros textos se destinan al fondo oscuro. El foco conserva su color también en Kids. Para botones de acento/Kids usar texto del token fondo. No combinar texto claro con superficie clara. El foco en superficie clara necesita una separación oscura de 2 px.

Los motivos y contornos se dibujaron para este encargo. La originalidad visual no implica una comprobación registral de marcas. Revisar la propuesta elegida antes de integrar/exportar en G2.
''',encoding='utf-8')

def page():
    sections=[]
    for p in PROPOSALS:
        bg,surface,ink,muted,accent,focus=p['palette']
        stages=[]
        for poster in (False,True):
            sizes=''.join(f'<figure><div class="sample" style="width:{size}px;height:{size}px">{symbol(p)}</div><figcaption>{size} × {size} px</figcaption></figure>' for size in (16,48,512))
            stages.append(f'<div><h3>{"Póster · placa oscura" if poster else "Fondo oscuro"}</h3><div class="stage {"poster" if poster else ""}">{sizes}</div></div>')
        rows=[]
        for token,c in list(zip(TOKENS,p['palette']))+[('Kids · acento alternativo',p['kids'])]:
            ratio=contrast(c,bg)
            status='Base · no aplica' if token=='fondo' else 'AA texto ✓ · UI ✓'
            rows.append(f'<tr><th><span class="swatch" style="background:{c}"></span>{token}</th><td><code>{c}</code></td><td>{ratio:.2f}:1</td><td>{status}</td></tr>')
        sections.append(f'''<article id="{p['id']}" style="--bg:{bg};--surface:{surface};--ink:{ink};--muted:{muted};--accent:{accent};--focus:{focus}">
<div class="intro"><p class="eyebrow">PROPUESTA {p['id'][:2]}</p><h2>{p['name']}</h2><p>{p['idea']}</p></div>
<h3>Cabecera TV · lienzo real de 1920 × 160 px</h3><p class="note">Desplaza horizontalmente para ver los 1920 px sin reducción. Solo «Kingdom» en la interfaz.</p>
<div class="tv-scroll"><div class="tv"><div class="brand"><div class="header-symbol">{symbol(p)}</div><div class="header-word">{wordmark(p)}</div></div><nav aria-label="Muestra de navegación {p['name']}"><span class="selected">Inicio</span><span>Películas</span><span>Series</span><span>TV en vivo</span></nav><span class="profile">Perfil</span></div></div>
<div class="stages">{''.join(stages)}</div>
<div class="details"><div><h3>Lettering de interfaz</h3><div class="logo-preview">{wordmark(p)}</div><h3>Variante exclusiva de metadatos</h3><div class="logo-preview">{wordmark(p,True)}</div><p class="note">Contornos originales; sin etiquetas SVG de texto ni fuentes externas.</p><h3>Acento y foco en uso</h3><div class="controls"><span class="action">Reproducir</span><span class="action focused">Con foco</span><span class="kids" style="background:{p['kids']}">Kids</span><span class="surface-demo">Superficie</span></div><p class="note">Tinta oscura en botones y superficies claras. Foco separado del acento; en Kids el foco conserva su token.</p></div>
<div><h3>Paleta · contraste sobre fondo {bg}</h3><table><thead><tr><th>Token</th><th>HEX</th><th>Ratio</th><th>Criterio</th></tr></thead><tbody>{''.join(rows)}</tbody></table><p class="note">AA: texto normal ≥ 4.5:1; texto grande y componentes ≥ 3:1. Fondo consigo mismo: 1:1, no es contenido. Superficie clara con tinta fondo: {contrast(surface,bg):.2f}:1. Texto secundario sobre fondo: {contrast(muted,bg):.2f}:1.</p></div></div>
</article>''')
    html='''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kingdom · propuestas G1</title><style>
*{box-sizing:border-box}body{margin:0;background:#0c1014;color:#f2f3ed;font-family:system-ui,sans-serif;line-height:1.6}header,main,footer{max-width:1500px;margin:auto;padding:40px}header{padding-top:64px}h1{font-size:clamp(36px,5vw,68px);line-height:1.1;margin:14px 0}h2{font-size:40px;line-height:1.2;margin:8px 0}h3{font-size:18px;margin:28px 0 12px}p{max-width:850px}.eyebrow{letter-spacing:.18em;font-size:12px;color:#b8c5cf}a{color:#b8ceff}header nav{display:flex;gap:24px;flex-wrap:wrap}.note{font-size:14px;color:var(--muted,#b8c5cf)}article{background:var(--bg);color:var(--ink);margin-bottom:48px;padding:32px;border:1px solid #52616c;border-radius:20px;overflow:hidden}.intro p{color:var(--muted)}.tv-scroll{overflow-x:auto;border:1px solid var(--muted);border-radius:12px}.tv{width:1920px;height:160px;display:flex;align-items:center;padding:0 72px;gap:96px;background:var(--bg)}.brand{display:flex;align-items:center;gap:18px}.header-symbol{width:56px;height:56px}.header-word{width:260px}.tv nav{display:flex;gap:48px;font-size:24px;align-items:center}.selected{border-bottom:4px solid var(--accent);padding:12px 0}.profile{margin-left:auto;font-size:24px;color:var(--muted)}svg{display:block;width:100%;height:100%}.stages{display:grid;grid-template-columns:1fr 1fr;gap:24px}.stage{overflow-x:auto;min-height:660px;border:1px solid var(--muted);border-radius:12px;padding:24px;background:var(--bg);display:flex;align-items:center;gap:24px;flex-wrap:wrap}.poster{background:linear-gradient(145deg,#dbab7e 0%,#766084 38%,#34545c 68%,#152428 100%)}figure{margin:0;flex-shrink:0}figcaption{font-size:13px;background:var(--bg);color:var(--muted);padding:4px 8px;margin-top:10px;width:max-content}.sample{background:var(--bg);flex-shrink:0}.poster .sample{outline:8px solid var(--bg);border-radius:2px}.details{display:grid;grid-template-columns:1fr 1fr;gap:36px}.logo-preview{width:min(100%,480px);height:120px;display:flex;align-items:center}.logo-preview svg{height:auto}.controls{display:flex;gap:22px;flex-wrap:wrap;padding:12px 4px}.action,.kids,.surface-demo{padding:12px 18px;border-radius:8px;background:var(--accent);color:var(--bg);font-weight:700}.focused{outline:3px solid var(--focus);outline-offset:5px}.surface-demo{background:var(--surface)}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:12px 6px;border-bottom:1px solid var(--muted)}th{font-weight:500}.swatch{display:inline-block;width:18px;height:18px;margin-right:8px;vertical-align:middle;border:1px solid var(--muted);border-radius:4px}code{font-size:12px}@media(max-width:1100px){.stages,.details{grid-template-columns:1fr}}@media(max-width:600px){header,main,footer{padding:20px}article{padding:18px}table{font-size:11px}.stage{padding:18px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style></head><body><header><p class="eyebrow">KINGDOM / ESTUDIO DE IDENTIDAD / G1</p><h1>Un reino para tu cine.</h1><p>Tres identidades vectoriales para la app personal de Samsung TV y Electron. Símbolos geométricos, acentos tranquilos y foco independiente. Esta página es una comparación de diseño; la selección e integración pertenecen a G2.</p><nav aria-label="Propuestas"><a href="#01-almena">01 · Almena</a><a href="#02-umbral">02 · Umbral</a><a href="#03-corona-abierta">03 · Corona abierta</a></nav></header><main>'''+''.join(sections)+'''</main><footer><p>Construcción propia con formas y contornos. Bricolage Grotesque y Manrope se mantienen como tipografías de producto; esta muestra utiliza la fuente del sistema únicamente para anotaciones.</p><p>Ratios calculados con luminancia relativa sRGB: canal ≤ 0.04045 → canal / 12.92; resto → ((canal + 0.055) / 1.055)<sup>2.4</sup>. L = 0.2126R + 0.7152G + 0.0722B. Contraste = (L mayor + 0.05) / (L menor + 0.05). Se decide el cumplimiento con el valor sin redondear.</p><p>Las muestras de 512 px mantienen su tamaño real y admiten desplazamiento en pantallas pequeñas. Sobre el degradado, la placa oscura asegura el contraste del símbolo. No se garantiza contraste sobre cualquier imagen sin placa.</p></footer></body></html>'''
    (ROOT/'index.html').write_text(html,encoding='utf-8')

def validate():
    for p in PROPOSALS:
        for filename in ('simbolo.svg','kingdom.svg','kingdom-player.svg'):
            tree=ET.parse(ROOT/p['id']/filename)
            assert all(e.tag.split('}')[-1] in ('svg','g','path') for e in tree.iter())
        for color in p['palette'][1:]+[p['kids']]: assert contrast(color,p['palette'][0])>=4.5
        assert p['palette'][4]!=p['palette'][5]
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    assert html.count('<svg ')==30
    assert 'src=' not in html and '<script' not in html
    print('9 SVG vectoriales válidos; 18 tokens + 3 Kids; AA verificado sin redondeo; HTML autónomo con 30 SVG inline.')
if __name__=='__main__':
    import sys
    if len(sys.argv)>1 and sys.argv[1] in ('1','2','3'): assets(PROPOSALS[int(sys.argv[1])-1])
    else: page();validate()
