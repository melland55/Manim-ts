/**
 * A library of LaTeX templates.
 * TypeScript port of manim/utils/tex_templates.py
 */

import { TexTemplate } from "../tex/index.js";

export { TexTemplate };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const _3b1b_preamble = `
\\usepackage[english]{babel}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{dsfont}
\\usepackage{setspace}
\\usepackage{tipa}
\\usepackage{relsize}
\\usepackage{textcomp}
\\usepackage{mathrsfs}
\\usepackage{calligra}
\\usepackage{wasysym}
\\usepackage{ragged2e}
\\usepackage{physics}
\\usepackage{xcolor}
\\usepackage{microtype}
\\DisableLigatures{encoding = *, family = * }
\\linespread{1}
`;

function _newAmsTemplate(): TexTemplate {
  const preamble = `
\\usepackage[english]{babel}
\\usepackage{amsmath}
\\usepackage{amssymb}
`;
  return new TexTemplate({ preamble });
}

// ─── TexTemplateLibrary ───────────────────────────────────────────────────────

/**
 * A collection of basic TeX template objects.
 *
 * @example
 * ```ts
 * new Tex("My TeX code", { texTemplate: TexTemplateLibrary.ctex })
 * ```
 */
export class TexTemplateLibrary {
  /** An instance of the default TeX template in manim */
  static readonly default = new TexTemplate({ preamble: _3b1b_preamble });

  /** An instance of the default TeX template used by 3b1b */
  static readonly threeb1b = new TexTemplate({ preamble: _3b1b_preamble });

  /** An instance of the TeX template used by 3b1b when using the use_ctex flag */
  static readonly ctex = new TexTemplate({
    texCompiler: "xelatex",
    outputFormat: ".xdv",
    preamble: _3b1b_preamble.replace(
      "\\DisableLigatures{encoding = *, family = * }",
      "\\usepackage[UTF8]{ctex}",
    ),
  });

  /** An instance of a simple TeX template with only basic AMS packages loaded */
  static readonly simple = _newAmsTemplate();
}

// ─── Module-level template instances (used by TexFontTemplates) ──────────────

// Latin Modern Typewriter Proportional
const lmtp = _newAmsTemplate();
lmtp.description = "Latin Modern Typewriter Proportional";
lmtp.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage[variablett]{lmodern}
\\renewcommand{\\rmdefault}{\\ttdefault}
\\usepackage[LGRgreek]{mathastext}
\\MTgreekfont{lmtt} % no lgr lmvtt, so use lgr lmtt
\\Mathastext
\\let\\varepsilon\\epsilon % only \\varsigma in LGR
`,
);

// Fourier Utopia (Fourier upright Greek)
const fufug = _newAmsTemplate();
fufug.description = "Fourier Utopia (Fourier upright Greek)";
fufug.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage[upright]{fourier}
\\usepackage{mathastext}
`,
);

// Droid Serif
const droidserif = _newAmsTemplate();
droidserif.description = "Droid Serif";
droidserif.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage[default]{droidserif}
\\usepackage[LGRgreek]{mathastext}
\\let\\varepsilon\\epsilon
`,
);

// Droid Sans
const droidsans = _newAmsTemplate();
droidsans.description = "Droid Sans";
droidsans.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage[default]{droidsans}
\\usepackage[LGRgreek]{mathastext}
\\let\\varepsilon\\epsilon
`,
);

// New Century Schoolbook (Symbol Greek)
const ncssg = _newAmsTemplate();
ncssg.description = "New Century Schoolbook (Symbol Greek)";
ncssg.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage{newcent}
\\usepackage[symbolgreek]{mathastext}
\\linespread{1.1}
`,
);

// French Cursive (Euler Greek)
const fceg = _newAmsTemplate();
fceg.description = "French Cursive (Euler Greek)";
fceg.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage[default]{frcursive}
\\usepackage[eulergreek,noplusnominus,noequal,nohbar,%
nolessnomore,noasterisk]{mathastext}
`,
);

// Auriocus Kalligraphicus (Symbol Greek)
const aksg = _newAmsTemplate();
aksg.description = "Auriocus Kalligraphicus (Symbol Greek)";
aksg.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage{aurical}
\\renewcommand{\\rmdefault}{AuriocusKalligraphicus}
\\usepackage[symbolgreek]{mathastext}
`,
);

// Palatino (Symbol Greek)
const palatinosg = _newAmsTemplate();
palatinosg.description = "Palatino (Symbol Greek)";
palatinosg.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage{palatino}
\\usepackage[symbolmax,defaultmathsizes]{mathastext}
`,
);

// Comfortaa
const comfortaa = _newAmsTemplate();
comfortaa.description = "Comfortaa";
comfortaa.addToPreamble(
  `
\\usepackage[default]{comfortaa}
\\usepackage[LGRgreek,defaultmathsizes,noasterisk]{mathastext}
\\let\\varphi\\phi
\\linespread{1.06}
`,
);

// ECF Augie (Euler Greek)
const ecfaugieeg = _newAmsTemplate();
ecfaugieeg.description = "ECF Augie (Euler Greek)";
ecfaugieeg.addToPreamble(
  `
\\renewcommand\\familydefault{fau} % emerald package
\\usepackage[defaultmathsizes,eulergreek]{mathastext}
`,
);

// Electrum ADF (CM Greek)
const electrumadfcm = _newAmsTemplate();
electrumadfcm.description = "Electrum ADF (CM Greek)";
electrumadfcm.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage[LGRgreek,basic,defaultmathsizes]{mathastext}
\\usepackage[lf]{electrum}
\\Mathastext
\\let\\varphi\\phi
`,
);

// American Typewriter
const americantypewriter = _newAmsTemplate();
americantypewriter.description = "American Typewriter";
americantypewriter.addToPreamble(
  `
\\usepackage[no-math]{fontspec}
\\setmainfont[Mapping=tex-text]{American Typewriter}
\\usepackage[defaultmathsizes]{mathastext}
`,
);
americantypewriter.texCompiler = "xelatex";
americantypewriter.outputFormat = ".xdv";

// Minion Pro and Myriad Pro (and TX fonts symbols)
const mpmptx = _newAmsTemplate();
mpmptx.description = "Minion Pro and Myriad Pro (and TX fonts symbols)";
mpmptx.addToPreamble(
  `
\\usepackage{txfonts}
\\usepackage[upright]{txgreeks}
\\usepackage[no-math]{fontspec}
\\setmainfont[Mapping=tex-text]{Minion Pro}
\\setsansfont[Mapping=tex-text,Scale=MatchUppercase]{Myriad Pro}
\\renewcommand\\familydefault\\sfdefault
\\usepackage[defaultmathsizes]{mathastext}
\\renewcommand\\familydefault\\rmdefault
`,
);
mpmptx.texCompiler = "xelatex";
mpmptx.outputFormat = ".xdv";

// New Century Schoolbook (Symbol Greek, PX math symbols)
const ncssgpxm = _newAmsTemplate();
ncssgpxm.description = "New Century Schoolbook (Symbol Greek, PX math symbols)";
ncssgpxm.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage{pxfonts}
\\usepackage{newcent}
\\usepackage[symbolgreek,defaultmathsizes]{mathastext}
\\linespread{1.06}
`,
);

// Vollkorn (TX fonts for Greek and math symbols)
const vollkorntx = _newAmsTemplate();
vollkorntx.description = "Vollkorn (TX fonts for Greek and math symbols)";
vollkorntx.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage{txfonts}
\\usepackage[upright]{txgreeks}
\\usepackage{vollkorn}
\\usepackage[defaultmathsizes]{mathastext}
`,
);

// Libertine
const libertine = _newAmsTemplate();
libertine.description = "Libertine";
libertine.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage{libertine}
\\usepackage[greek=n]{libgreek}
\\usepackage[noasterisk,defaultmathsizes]{mathastext}
`,
);

// SliTeX (Euler Greek)
const slitexeg = _newAmsTemplate();
slitexeg.description = "SliTeX (Euler Greek)";
slitexeg.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage{tpslifonts}
\\usepackage[eulergreek,defaultmathsizes]{mathastext}
\\MTEulerScale{1.06}
\\linespread{1.2}
`,
);

// ECF Webster (with TX fonts)
const ecfwebstertx = _newAmsTemplate();
ecfwebstertx.description = "ECF Webster (with TX fonts)";
ecfwebstertx.addToPreamble(
  `
\\usepackage{txfonts}
\\usepackage[upright]{txgreeks}
\\renewcommand\\familydefault{fwb} % emerald package
\\usepackage{mathastext}
\\renewcommand{\\int}{\\intop\\limits}
\\linespread{1.5}
`,
);
ecfwebstertx.addToDocument(
  `
\\mathversion{bold}
`,
);

// Romande ADF with Fourier (Italic)
const italicromandeadff = _newAmsTemplate();
italicromandeadff.description = "Romande ADF with Fourier (Italic)";
italicromandeadff.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage{fourier}
\\usepackage{romande}
\\usepackage[italic,defaultmathsizes,noasterisk]{mathastext}
\\renewcommand{\\itshape}{\\swashstyle}
`,
);

// Apple Chancery
const applechancery = _newAmsTemplate();
applechancery.description = "Apple Chancery";
applechancery.addToPreamble(
  `
\\usepackage[no-math]{fontspec}
\\setmainfont[Mapping=tex-text]{Apple Chancery}
\\usepackage[defaultmathsizes]{mathastext}
`,
);
applechancery.texCompiler = "xelatex";
applechancery.outputFormat = ".xdv";

// Zapf Chancery
const zapfchancery = _newAmsTemplate();
zapfchancery.description = "Zapf Chancery";
zapfchancery.addToPreamble(
  `
\\DeclareFontFamily{T1}{pzc}{}
\\DeclareFontShape{T1}{pzc}{mb}{it}{<->s*[1.2] pzcmi8t}{}
\\DeclareFontShape{T1}{pzc}{m}{it}{<->ssub * pzc/mb/it}{}
\\usepackage{chancery} % = \\renewcommand{\\rmdefault}{pzc}
\\renewcommand\\shapedefault\\itdefault
\\renewcommand\\bfdefault\\mddefault
\\usepackage[defaultmathsizes]{mathastext}
\\linespread{1.05}
`,
);

// Verdana (Italic)
const italicverdana = _newAmsTemplate();
italicverdana.description = "Verdana (Italic)";
italicverdana.addToPreamble(
  `
\\usepackage[no-math]{fontspec}
\\setmainfont[Mapping=tex-text]{Verdana}
\\usepackage[defaultmathsizes,italic]{mathastext}
`,
);
italicverdana.texCompiler = "xelatex";
italicverdana.outputFormat = ".xdv";

// URW Zapf Chancery (CM Greek)
const urwzccmg = _newAmsTemplate();
urwzccmg.description = "URW Zapf Chancery (CM Greek)";
urwzccmg.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\DeclareFontFamily{T1}{pzc}{}
\\DeclareFontShape{T1}{pzc}{mb}{it}{<->s*[1.2] pzcmi8t}{}
\\DeclareFontShape{T1}{pzc}{m}{it}{<->ssub * pzc/mb/it}{}
\\DeclareFontShape{T1}{pzc}{mb}{sl}{<->ssub * pzc/mb/it}{}
\\DeclareFontShape{T1}{pzc}{m}{sl}{<->ssub * pzc/mb/sl}{}
\\DeclareFontShape{T1}{pzc}{m}{n}{<->ssub * pzc/mb/it}{}
\\usepackage{chancery}
\\usepackage{mathastext}
\\linespread{1.05}`,
);
urwzccmg.addToDocument(
  `
\\boldmath
`,
);

// Comic Sans MS
const comicsansms = _newAmsTemplate();
comicsansms.description = "Comic Sans MS";
comicsansms.addToPreamble(
  `
\\usepackage[no-math]{fontspec}
\\setmainfont[Mapping=tex-text]{Comic Sans MS}
\\usepackage[defaultmathsizes]{mathastext}
`,
);
comicsansms.texCompiler = "xelatex";
comicsansms.outputFormat = ".xdv";

// GFS Didot (Italic)
const italicgfsdidot = _newAmsTemplate();
italicgfsdidot.description = "GFS Didot (Italic)";
italicgfsdidot.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\renewcommand\\rmdefault{udidot}
\\usepackage[LGRgreek,defaultmathsizes,italic]{mathastext}
\\let\\varphi\\phi
`,
);

// Chalkduster
const chalkduster = _newAmsTemplate();
chalkduster.description = "Chalkduster";
chalkduster.addToPreamble(
  `
\\usepackage[no-math]{fontspec}
\\setmainfont[Mapping=tex-text]{Chalkduster}
\\usepackage[defaultmathsizes]{mathastext}
`,
);
chalkduster.texCompiler = "lualatex";
chalkduster.outputFormat = ".pdf";

// Minion Pro (and TX fonts symbols)
const mptx = _newAmsTemplate();
mptx.description = "Minion Pro (and TX fonts symbols)";
mptx.addToPreamble(
  `
\\usepackage{txfonts}
\\usepackage[no-math]{fontspec}
\\setmainfont[Mapping=tex-text]{Minion Pro}
\\usepackage[defaultmathsizes]{mathastext}
`,
);
mptx.texCompiler = "xelatex";
mptx.outputFormat = ".xdv";

// GNU FreeSerif and FreeSans
const gnufsfs = _newAmsTemplate();
gnufsfs.description = "GNU FreeSerif and FreeSans";
gnufsfs.addToPreamble(
  `
\\usepackage[no-math]{fontspec}
\\setmainfont[ExternalLocation,
                Mapping=tex-text,
                BoldFont=FreeSerifBold,
                ItalicFont=FreeSerifItalic,
                BoldItalicFont=FreeSerifBoldItalic]{FreeSerif}
\\setsansfont[ExternalLocation,
                Mapping=tex-text,
                BoldFont=FreeSansBold,
                ItalicFont=FreeSansOblique,
                BoldItalicFont=FreeSansBoldOblique,
                Scale=MatchLowercase]{FreeSans}
\\renewcommand{\\familydefault}{lmss}
\\usepackage[LGRgreek,defaultmathsizes,noasterisk]{mathastext}
\\renewcommand{\\familydefault}{\\sfdefault}
\\Mathastext
\\let\\varphi\\phi % no \`var' phi in LGR encoding
\\renewcommand{\\familydefault}{\\rmdefault}
`,
);
gnufsfs.texCompiler = "xelatex";
gnufsfs.outputFormat = ".xdv";

// GFS NeoHellenic
const gfsneohellenic = _newAmsTemplate();
gfsneohellenic.description = "GFS NeoHellenic";
gfsneohellenic.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\renewcommand{\\rmdefault}{neohellenic}
\\usepackage[LGRgreek]{mathastext}
\\let\\varphi\\phi
\\linespread{1.06}
`,
);

// ECF Tall Paul (with Symbol font)
const ecftallpaul = _newAmsTemplate();
ecftallpaul.description = "ECF Tall Paul (with Symbol font)";
ecftallpaul.addToPreamble(
  `
\\DeclareFontFamily{T1}{ftp}{}
\\DeclareFontShape{T1}{ftp}{m}{n}{
    <->s*[1.4] ftpmw8t
}{} % increase size by factor 1.4
\\renewcommand\\familydefault{ftp} % emerald package
\\usepackage[symbol]{mathastext}
\\let\\infty\\inftypsy
`,
);

// Droid Sans (Italic)
const italicdroidsans = _newAmsTemplate();
italicdroidsans.description = "Droid Sans (Italic)";
italicdroidsans.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage[default]{droidsans}
\\usepackage[LGRgreek,defaultmathsizes,italic]{mathastext}
\\let\\varphi\\phi
`,
);

// Baskerville (Italic)
const italicbaskerville = _newAmsTemplate();
italicbaskerville.description = "Baskerville (Italic)";
italicbaskerville.addToPreamble(
  `
\\usepackage[no-math]{fontspec}
\\setmainfont[Mapping=tex-text]{Baskerville}
\\usepackage[defaultmathsizes,italic]{mathastext}
`,
);
italicbaskerville.texCompiler = "xelatex";
italicbaskerville.outputFormat = ".xdv";

// ECF JD (with TX fonts)
const ecfjdtx = _newAmsTemplate();
ecfjdtx.description = "ECF JD (with TX fonts)";
ecfjdtx.addToPreamble(
  `
\\usepackage{txfonts}
\\usepackage[upright]{txgreeks}
\\renewcommand\\familydefault{fjd} % emerald package
\\usepackage{mathastext}
`,
);
ecfjdtx.addToDocument(
  `\\mathversion{bold}
`,
);

// Antykwa Półtawskiego (TX Fonts for Greek and math symbols)
const aptxgm = _newAmsTemplate();
aptxgm.description = "Antykwa Półtawskiego (TX Fonts for Greek and math symbols)";
aptxgm.addToPreamble(
  `
\\usepackage[OT4,OT1]{fontenc}
\\usepackage{txfonts}
\\usepackage[upright]{txgreeks}
\\usepackage{antpolt}
\\usepackage[defaultmathsizes,nolessnomore]{mathastext}
`,
);

// Papyrus
const papyrus = _newAmsTemplate();
papyrus.description = "Papyrus";
papyrus.addToPreamble(
  `
\\usepackage[no-math]{fontspec}
\\setmainfont[Mapping=tex-text]{Papyrus}
\\usepackage[defaultmathsizes]{mathastext}
`,
);
papyrus.texCompiler = "xelatex";
papyrus.outputFormat = ".xdv";

// GNU FreeSerif (and TX fonts symbols)
const gnufstx = _newAmsTemplate();
gnufstx.description = "GNU FreeSerif (and TX fonts symbols)";
gnufstx.addToPreamble(
  `
\\usepackage[no-math]{fontspec}
\\usepackage{txfonts}  %\\let\\mathbb=\\varmathbb
\\setmainfont[ExternalLocation,
                Mapping=tex-text,
                BoldFont=FreeSerifBold,
                ItalicFont=FreeSerifItalic,
                BoldItalicFont=FreeSerifBoldItalic]{FreeSerif}
\\usepackage[defaultmathsizes]{mathastext}
`,
);
gnufstx.texCompiler = "xelatex";
gnufstx.outputFormat = ".pdf";

// ECF Skeetch (CM Greek)
const ecfscmg = _newAmsTemplate();
ecfscmg.description = "ECF Skeetch (CM Greek)";
ecfscmg.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage[T1]{fontenc}
\\DeclareFontFamily{T1}{fsk}{}
\\DeclareFontShape{T1}{fsk}{m}{n}{<->s*[1.315] fskmw8t}{}
\\renewcommand\\rmdefault{fsk}
\\usepackage[noendash,defaultmathsizes,nohbar,defaultimath]{mathastext}
`,
);

// Latin Modern Typewriter Proportional (CM Greek) (Italic)
const italiclmtpcm = _newAmsTemplate();
italiclmtpcm.description = "Latin Modern Typewriter Proportional (CM Greek) (Italic)";
italiclmtpcm.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage[variablett,nomath]{lmodern}
\\renewcommand{\\familydefault}{\\ttdefault}
\\usepackage[frenchmath]{mathastext}
\\linespread{1.08}
`,
);

// Baskervald ADF with Fourier
const baskervaldadff = _newAmsTemplate();
baskervaldadff.description = "Baskervald ADF with Fourier";
baskervaldadff.addToPreamble(
  `
\\usepackage[upright]{fourier}
\\usepackage{baskervald}
\\usepackage[defaultmathsizes,noasterisk]{mathastext}
`,
);

// Droid Serif (PX math symbols) (Italic)
const italicdroidserifpx = _newAmsTemplate();
italicdroidserifpx.description = "Droid Serif (PX math symbols) (Italic)";
italicdroidserifpx.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage{pxfonts}
\\usepackage[default]{droidserif}
\\usepackage[LGRgreek,defaultmathsizes,italic,basic]{mathastext}
\\let\\varphi\\phi
`,
);

// Biolinum
const biolinum = _newAmsTemplate();
biolinum.description = "Biolinum";
biolinum.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage{libertine}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage[greek=n,biolinum]{libgreek}
\\usepackage[noasterisk,defaultmathsizes]{mathastext}
`,
);

// Vollkorn with Fourier (Italic)
const italicvollkornf = _newAmsTemplate();
italicvollkornf.description = "Vollkorn with Fourier (Italic)";
italicvollkornf.addToPreamble(
  `
\\usepackage{fourier}
\\usepackage{vollkorn}
\\usepackage[italic,nohbar]{mathastext}
`,
);

// Chalkboard SE
const chalkboardse = _newAmsTemplate();
chalkboardse.description = "Chalkboard SE";
chalkboardse.addToPreamble(
  `
\\usepackage[no-math]{fontspec}
\\setmainfont[Mapping=tex-text]{Chalkboard SE}
\\usepackage[defaultmathsizes]{mathastext}
`,
);
chalkboardse.texCompiler = "xelatex";
chalkboardse.outputFormat = ".xdv";

// Noteworthy Light
const noteworthylight = _newAmsTemplate();
noteworthylight.description = "Noteworthy Light";
noteworthylight.addToPreamble(
  `
\\usepackage[no-math]{fontspec}
\\setmainfont[Mapping=tex-text]{Noteworthy Light}
\\usepackage[defaultmathsizes]{mathastext}
`,
);

// Epigrafica
const epigrafica = _newAmsTemplate();
epigrafica.description = "Epigrafica";
epigrafica.addToPreamble(
  `
\\usepackage[LGR,OT1]{fontenc}
\\usepackage{epigrafica}
\\usepackage[basic,LGRgreek,defaultmathsizes]{mathastext}
\\let\\varphi\\phi
\\linespread{1.2}
`,
);

// Libris ADF with Fourier
const librisadff = _newAmsTemplate();
librisadff.description = "Libris ADF with Fourier";
librisadff.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage[upright]{fourier}
\\usepackage{libris}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage[noasterisk]{mathastext}
`,
);

// Venturis ADF with Fourier (Italic)
const italicvanturisadff = _newAmsTemplate();
italicvanturisadff.description = "Venturis ADF with Fourier (Italic)";
italicvanturisadff.addToPreamble(
  `
\\usepackage{fourier}
\\usepackage[lf]{venturis}
\\usepackage[italic,defaultmathsizes,noasterisk]{mathastext}
`,
);

// GFS Bodoni
const gfsbodoni = _newAmsTemplate();
gfsbodoni.description = "GFS Bodoni";
gfsbodoni.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\renewcommand{\\rmdefault}{bodoni}
\\usepackage[LGRgreek]{mathastext}
\\let\\varphi\\phi
\\linespread{1.06}
`,
);

// BrushScriptX-Italic (PX math and Greek)
const brushscriptxpx = _newAmsTemplate();
brushscriptxpx.description = "BrushScriptX-Italic (PX math and Greek)";
brushscriptxpx.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage{pxfonts}
%\\usepackage{pbsi}
\\renewcommand{\\rmdefault}{pbsi}
\\renewcommand{\\mddefault}{xl}
\\renewcommand{\\bfdefault}{xl}
\\usepackage[defaultmathsizes,noasterisk]{mathastext}
`,
);
brushscriptxpx.addToDocument(
  `\\boldmath
`,
);
brushscriptxpx.texCompiler = "xelatex";
brushscriptxpx.outputFormat = ".xdv";

// URW Avant Garde (Symbol Greek)
const urwagsg = _newAmsTemplate();
urwagsg.description = "URW Avant Garde (Symbol Greek)";
urwagsg.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage{avant}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage[symbolgreek,defaultmathsizes]{mathastext}
`,
);

// Times with Fourier (Italic)
const italictimesf = _newAmsTemplate();
italictimesf.description = "Times with Fourier (Italic)";
italictimesf.addToPreamble(
  `
\\usepackage{fourier}
\\renewcommand{\\rmdefault}{ptm}
\\usepackage[italic,defaultmathsizes,noasterisk]{mathastext}
`,
);

// Helvetica with Fourier (Italic)
const italichelveticaf = _newAmsTemplate();
italichelveticaf.description = "Helvetica with Fourier (Italic)";
italichelveticaf.addToPreamble(
  `
\\usepackage[T1]{fontenc}
\\usepackage[scaled]{helvet}
\\usepackage{fourier}
\\renewcommand{\\rmdefault}{phv}
\\usepackage[italic,defaultmathsizes,noasterisk]{mathastext}
`,
);

// ─── TexFontTemplates ─────────────────────────────────────────────────────────

/**
 * A collection of TeX templates for the fonts described at
 * http://jf.burnol.free.fr/showcase.html
 *
 * These templates are specifically designed to allow you to typeset formulae
 * and mathematics using different fonts. They are based on the mathastext
 * LaTeX package.
 *
 * @example
 * ```ts
 * new Tex("My TeX code", { texTemplate: TexFontTemplates.comic_sans })
 * ```
 *
 * @note Many of these templates require specific fonts installed on your
 * local machine.
 */
export class TexFontTemplates {
  /** American Typewriter */
  static readonly american_typewriter = americantypewriter;
  /** Antykwa Półtawskiego (TX Fonts for Greek and math symbols) */
  static readonly antykwa = aptxgm;
  /** Apple Chancery */
  static readonly apple_chancery = applechancery;
  /** Auriocus Kalligraphicus (Symbol Greek) */
  static readonly auriocus_kalligraphicus = aksg;
  /** Baskervald ADF with Fourier */
  static readonly baskervald_adf_fourier = baskervaldadff;
  /** Baskerville (Italic) */
  static readonly baskerville_it = italicbaskerville;
  /** Biolinum */
  static readonly biolinum = biolinum;
  /** BrushScriptX-Italic (PX math and Greek) */
  static readonly brushscriptx = brushscriptxpx;
  /** Chalkboard SE */
  static readonly chalkboard_se = chalkboardse;
  /** Chalkduster */
  static readonly chalkduster = chalkduster;
  /** Comfortaa */
  static readonly comfortaa = comfortaa;
  /** Comic Sans MS */
  static readonly comic_sans = comicsansms;
  /** Droid Sans */
  static readonly droid_sans = droidsans;
  /** Droid Sans (Italic) */
  static readonly droid_sans_it = italicdroidsans;
  /** Droid Serif */
  static readonly droid_serif = droidserif;
  /** Droid Serif (PX math symbols) (Italic) */
  static readonly droid_serif_px_it = italicdroidserifpx;
  /** ECF Augie (Euler Greek) */
  static readonly ecf_augie = ecfaugieeg;
  /** ECF JD (with TX fonts) */
  static readonly ecf_jd = ecfjdtx;
  /** ECF Skeetch (CM Greek) */
  static readonly ecf_skeetch = ecfscmg;
  /** ECF Tall Paul (with Symbol font) */
  static readonly ecf_tall_paul = ecftallpaul;
  /** ECF Webster (with TX fonts) */
  static readonly ecf_webster = ecfwebstertx;
  /** Electrum ADF (CM Greek) */
  static readonly electrum_adf = electrumadfcm;
  /** Epigrafica */
  static readonly epigrafica = epigrafica;
  /** Fourier Utopia (Fourier upright Greek) */
  static readonly fourier_utopia = fufug;
  /** French Cursive (Euler Greek) */
  static readonly french_cursive = fceg;
  /** GFS Bodoni */
  static readonly gfs_bodoni = gfsbodoni;
  /** GFS Didot (Italic) */
  static readonly gfs_didot = italicgfsdidot;
  /** GFS NeoHellenic */
  static readonly gfs_neoHellenic = gfsneohellenic;
  /** GNU FreeSerif (and TX fonts symbols) */
  static readonly gnu_freesans_tx = gnufstx;
  /** GNU FreeSerif and FreeSans */
  static readonly gnu_freeserif_freesans = gnufsfs;
  /** Helvetica with Fourier (Italic) */
  static readonly helvetica_fourier_it = italichelveticaf;
  /** Latin Modern Typewriter Proportional (CM Greek) (Italic) */
  static readonly latin_modern_tw_it = italiclmtpcm;
  /** Latin Modern Typewriter Proportional */
  static readonly latin_modern_tw = lmtp;
  /** Libertine */
  static readonly libertine = libertine;
  /** Libris ADF with Fourier */
  static readonly libris_adf_fourier = librisadff;
  /** Minion Pro and Myriad Pro (and TX fonts symbols) */
  static readonly minion_pro_myriad_pro = mpmptx;
  /** Minion Pro (and TX fonts symbols) */
  static readonly minion_pro_tx = mptx;
  /** New Century Schoolbook (Symbol Greek) */
  static readonly new_century_schoolbook = ncssg;
  /** New Century Schoolbook (Symbol Greek, PX math symbols) */
  static readonly new_century_schoolbook_px = ncssgpxm;
  /** Noteworthy Light */
  static readonly noteworthy_light = noteworthylight;
  /** Palatino (Symbol Greek) */
  static readonly palatino = palatinosg;
  /** Papyrus */
  static readonly papyrus = papyrus;
  /** Romande ADF with Fourier (Italic) */
  static readonly romande_adf_fourier_it = italicromandeadff;
  /** SliTeX (Euler Greek) */
  static readonly slitex = slitexeg;
  /** Times with Fourier (Italic) */
  static readonly times_fourier_it = italictimesf;
  /** URW Avant Garde (Symbol Greek) */
  static readonly urw_avant_garde = urwagsg;
  /** URW Zapf Chancery (CM Greek) */
  static readonly urw_zapf_chancery = urwzccmg;
  /** Venturis ADF with Fourier (Italic) */
  static readonly venturis_adf_fourier_it = italicvanturisadff;
  /** Verdana (Italic) */
  static readonly verdana_it = italicverdana;
  /** Vollkorn with Fourier (Italic) */
  static readonly vollkorn_fourier_it = italicvollkornf;
  /** Vollkorn (TX fonts for Greek and math symbols) */
  static readonly vollkorn = vollkorntx;
  /** Zapf Chancery */
  static readonly zapf_chancery = zapfchancery;
}
