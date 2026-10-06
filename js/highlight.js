/**
 * ===================================================================
 * piezuke_ — tiny syntax highlighter (no dependencies)
 * ===================================================================
 * Turns <pre><code class="language-xxx"> blocks into coloured spans.
 * Written as one combined regular expression per language, so a block
 * is tokenised in a single pass. Unknown languages are left untouched.
 *
 * Languages: c, cpp, java, python, js/ts, bash, asm (x86 / ARM), rust, go,
 *            json, diff, sql, html/xml, css, yaml  (+ common aliases)
 *
 * Token classes:  hl-k keyword   hl-t type     hl-s string   hl-c comment
 *                 hl-n number    hl-f function hl-a attribute hl-p meta
 *                 hl-v variable  hl-r register hl-add / hl-del diff lines
 */
(function () {
  "use strict";

  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const words = (list) => "\\b(?:" + list.trim().split(/\s+/).join("|") + ")\\b";

  /* rule = [cssLetter, regexSource]. Sources use NON-capturing groups only. */
  const LANGS = {};
  function def(names, rules, flags) {
    const re = new RegExp(rules.map((r) => "(" + r[1] + ")").join("|"), "g" + (flags || "m"));
    const spec = { re, classes: rules.map((r) => r[0]) };
    names.split(" ").forEach((n) => (LANGS[n] = spec));
  }

  const CSTR = `"(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'`;
  const CNUM = `\\b(?:0[xX][0-9a-fA-F']+|0[bB][01']+|\\d[\\d']*\\.?\\d*(?:[eE][+-]?\\d+)?)[uUlLfF]*\\b`;
  const CFUNC = `\\b[A-Za-z_]\\w*(?=\\s*\\()`;
  const CCOMMENT = `\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/`;

  /* ---------------- C / C++ ---------------- */
  def("c h", [
    ["c", CCOMMENT],
    ["s", CSTR],
    ["p", `^[ \\t]*#[ \\t]*\\w+[^\\n]*`],
    ["n", CNUM],
    ["k", words(`if else for while do switch case default break continue return goto sizeof typedef struct union enum static extern const volatile register inline restrict asm NULL true false`)],
    ["t", words(`void char short int long float double signed unsigned bool _Bool size_t ssize_t ptrdiff_t uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t uintptr_t intptr_t FILE wchar_t`)],
    ["f", CFUNC],
  ]);
  def("cpp c++ cc cxx hpp hxx", [
    ["c", CCOMMENT],
    ["s", `R"\\((?:[\\s\\S]*?)\\)"|` + CSTR],
    ["p", `^[ \\t]*#[ \\t]*\\w+[^\\n]*`],
    ["n", CNUM],
    ["k", words(`if else for while do switch case default break continue return goto sizeof typedef struct union enum static extern const constexpr volatile inline class public private protected virtual override final template typename namespace using new delete try catch throw operator this nullptr true false auto explicit noexcept mutable friend`)],
    ["t", words(`void char short int long float double signed unsigned bool size_t ssize_t uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t string vector map set unordered_map unique_ptr shared_ptr std`)],
    ["f", CFUNC],
  ]);

  /* ---------------- Java ---------------- */
  def("java", [
    ["c", CCOMMENT],
    ["s", CSTR],
    ["p", `@\\w+`],
    ["n", CNUM],
    ["k", words(`abstract assert break case catch class const continue default do else enum extends final finally for goto if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try volatile while true false null var record`)],
    ["t", words(`boolean byte char double float int long short void String Object List Map Set Integer Long Double`)],
    ["f", CFUNC],
  ]);

  /* ---------------- Python ---------------- */
  def("python py python3 pwn", [
    ["c", `#[^\\n]*`],
    ["s", `[rRbBfFuU]{0,2}(?:"""[\\s\\S]*?"""|'''[\\s\\S]*?''')|[rRbBfFuU]{0,2}(?:"(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*')`],
    ["p", `^[ \\t]*@[\\w.]+`],
    ["n", `\\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|\\d[\\d_]*\\.?\\d*(?:[eE][+-]?\\d+)?)\\b`],
    ["k", words(`and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield None True False self cls`)],
    ["t", words(`print len range int str float list dict set tuple bool bytes bytearray open type isinstance enumerate zip map filter sorted sum min max abs hex ord chr input exec eval super p64 p32 u64 u32 flat cyclic remote process context ELF ROP`)],
    ["f", CFUNC],
  ]);

  /* ---------------- JavaScript / TypeScript ---------------- */
  const JSKW = `const let var function return if else for while do switch case break continue new delete typeof instanceof in of class extends super this import export from default async await try catch finally throw yield void null undefined true false static get set`;
  const JSTYPES = `Array Object String Number Boolean Promise Map Set Date Math JSON Error RegExp Symbol BigInt console window document globalThis`;
  def("javascript js mjs jsx node", [
    ["c", CCOMMENT],
    ["s", "`(?:\\\\.|[^`\\\\])*`|" + CSTR],
    ["n", CNUM],
    ["k", words(JSKW)],
    ["t", words(JSTYPES)],
    ["f", CFUNC],
  ]);
  def("typescript ts tsx", [
    ["c", CCOMMENT],
    ["s", "`(?:\\\\.|[^`\\\\])*`|" + CSTR],
    ["n", CNUM],
    ["k", words(JSKW + " interface type enum implements public private protected readonly as namespace declare abstract")],
    ["t", words(JSTYPES + " string number boolean any unknown never void object")],
    ["f", CFUNC],
  ]);

  /* ---------------- Shell ---------------- */
  def("bash sh shell zsh console shell-session terminal", [
    ["c", `#[^\\n]*`],
    ["s", `"(?:\\\\.|[^"\\\\])*"|'[^']*'`],
    ["v", `\\$(?:\\{[^}\\n]*\\}|\\w+|[@#?$!*0-9])`],
    ["a", `\\B--?[A-Za-z][\\w-]*`],
    ["n", `\\b(?:0[xX][0-9a-fA-F]+|\\d+)\\b`],
    ["k", words(`if then else elif fi for while do done case esac in function select until return exit break continue local export readonly declare unset source alias`)],
    ["t", words(`echo cd ls cat grep sed awk chmod chown sudo curl wget python python3 gcc make nc ncat ssh scp tar git docker pwn checksec gdb objdump strings file find xargs kill ps head tail cut sort uniq tee mkdir rm cp mv ln touch printf read test nmap ghidra radare2 r2 ltrace strace patchelf one_gadget ROPgadget`)],
  ]);

  /* ---------------- Assembly (x86 / x86-64 / ARM) ---------------- */
  def(
    "asm nasm x86 x86asm x64 assembly s arm gas",
    [
      ["c", `;[^\\n]*|\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|#[^\\n]*`],
      ["s", `"(?:\\\\.|[^"\\\\\\n])*"|'[^'\\n]'`],
      ["f", `^[ \\t]*[.\\w@$]+:`],
      ["p", `\\.\\w+|\\b(?:section|segment|global|extern|db|dw|dd|dq|equ|times|bits|org|align|byte|word|dword|qword|ptr|offset)\\b`],
      ["r", `\\b(?:[re]?[abcd]x|[abcd][lh]|[re]?[sd]il?|[re]?[sb]pl?|[re]?ip|r(?:[89]|1[0-5])[dwb]?|[xyz]mm\\d+|[cdefgs]s|st\\d?|x(?:[0-9]|[12][0-9]|30)|w(?:[0-9]|[12][0-9]|30)|sp|lr|pc|fp|[re]?flags|cr[0-4])\\b|%[a-z]\\w*`],
      ["n", `\\$?-?\\b0[xX][0-9a-fA-F]+\\b|\\b[0-9][0-9a-fA-F]*[hH]\\b|\\$?\\b\\d+\\b`],
      ["k", `\\b(?:mov|movzx|movsx|movsxd|lea|push|pop|call|ret|jmp|je|jne|jz|jnz|jg|jge|jl|jle|ja|jae|jb|jbe|js|jns|cmp|test|add|sub|mul|imul|div|idiv|inc|dec|and|or|xor|not|neg|shl|shr|sar|sal|rol|ror|nop|int3?|syscall|sysenter|leave|enter|cdq|cqo|cld|std|rep|repe|repne|movs[bwdq]?|stos[bwdq]?|lods[bwdq]?|scas[bwdq]?|cmov\\w+|set\\w+|xchg|bswap|hlt|ldr|str|bl|blx|bx|b|beq|bne|svc|stp|ldp|adr|adrp|mrs|msr|eor|orr|lsl|lsr|asr)\\b`],
    ],
    "mi",
  );

  /* ---------------- Rust ---------------- */
  def("rust rs", [
    ["c", CCOMMENT],
    ["s", `"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\\\n])'`],
    ["a", `'[a-zA-Z_]\\w*\\b`],
    ["p", `#!?\\[[^\\]\\n]*\\]`],
    ["n", CNUM],
    ["k", words(`as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self static struct super trait true type unsafe use where while`)],
    ["t", words(`i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str String Vec Option Result Box Self Some None Ok Err`)],
    ["f", `\\b[A-Za-z_]\\w*!?(?=\\s*[(\\[{])`],
  ]);

  /* ---------------- Go ---------------- */
  def("go golang", [
    ["c", CCOMMENT],
    ["s", "`[^`]*`|" + CSTR],
    ["n", CNUM],
    ["k", words(`break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false iota`)],
    ["t", words(`int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 uintptr byte rune string float32 float64 complex128 bool error any`)],
    ["f", CFUNC],
  ]);

  /* ---------------- JSON ---------------- */
  def("json jsonc", [
    ["a", `"(?:\\\\.|[^"\\\\\\n])*"(?=\\s*:)`],
    ["s", `"(?:\\\\.|[^"\\\\\\n])*"`],
    ["n", `-?\\b\\d+\\.?\\d*(?:[eE][+-]?\\d+)?\\b`],
    ["k", words(`true false null`)],
  ]);

  /* ---------------- diff ---------------- */
  def("diff patch", [
    ["p", `^@@[^\\n]*`],
    ["c", `^(?:diff |index |--- |\\+\\+\\+ )[^\\n]*`],
    ["add", `^\\+[^\\n]*`],
    ["del", `^-[^\\n]*`],
  ]);

  /* ---------------- SQL ---------------- */
  def(
    "sql",
    [
      ["c", `--[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/`],
      ["s", `'(?:''|[^'])*'`],
      ["n", `\\b\\d+\\.?\\d*\\b`],
      ["k", words(`select from where and or not in is null like insert into values update set delete create drop alter table database index view join left right inner outer full on group by order having limit offset union all distinct as case when then else end exists between primary key foreign references default`)],
      ["t", words(`int integer bigint smallint varchar char text boolean date datetime timestamp float double decimal blob`)],
      ["f", CFUNC],
    ],
    "mi",
  );

  /* ---------------- HTML / XML ---------------- */
  def("html xml svg htm", [
    ["c", `<!--[\\s\\S]*?-->`],
    ["k", `<\\/?[A-Za-z][\\w:-]*|\\/?>`],
    ["a", `\\b[A-Za-z_:][\\w:.-]*(?=\\s*=)`],
    ["s", `"[^"]*"|'[^']*'`],
    ["n", `&[#\\w]+;`],
  ]);

  /* ---------------- CSS ---------------- */
  def("css scss", [
    ["c", `\\/\\*[\\s\\S]*?\\*\\/`],
    ["s", CSTR],
    ["k", `@[\\w-]+`],
    ["a", `[A-Za-z-]+(?=\\s*:)`],
    ["n", `#[0-9a-fA-F]{3,8}\\b|-?\\b\\d*\\.?\\d+(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\\b`],
  ]);

  /* ---------------- YAML ---------------- */
  def("yaml yml toml ini", [
    ["c", `#[^\\n]*`],
    ["a", `^[ \\t-]*[\\w.-]+(?=\\s*[:=])`],
    ["s", CSTR],
    ["n", `\\b\\d+\\.?\\d*\\b`],
    ["k", words(`true false null yes no on off`)],
  ]);

  /* ===================================================================
   * engine
   * =================================================================== */
  const MAX_CHARS = 40000; // very long blocks are left plain (keeps pages snappy)

  function highlight(code, lang) {
    const spec = LANGS[String(lang || "").toLowerCase()];
    if (!spec || code.length > MAX_CHARS) return null;
    const re = spec.re;
    re.lastIndex = 0;
    let out = "";
    let last = 0;
    let m;
    while ((m = re.exec(code))) {
      if (m[0] === "") {
        re.lastIndex++;
        continue;
      }
      if (m.index > last) out += esc(code.slice(last, m.index));
      let cls = "";
      for (let i = 1; i < m.length; i++) {
        if (m[i] !== undefined) {
          cls = spec.classes[i - 1];
          break;
        }
      }
      out += `<span class="hl-${cls}">${esc(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    if (last < code.length) out += esc(code.slice(last));
    return out;
  }

  function langOf(codeEl) {
    for (const c of codeEl.classList) {
      if (c.indexOf("language-") === 0) return c.slice(9).toLowerCase();
      if (c.indexOf("lang-") === 0) return c.slice(5).toLowerCase();
    }
    return "";
  }

  // options: { highlight: bool, label: bool }
  function highlightAll(root, options) {
    const opt = Object.assign({ highlight: true, label: true }, options || {});
    (root || document).querySelectorAll("pre > code").forEach((code) => {
      const lang = langOf(code);
      const pre = code.parentElement;
      if (lang && opt.label && lang !== "text" && lang !== "plain") pre.setAttribute("data-lang", lang);
      if (!opt.highlight || code.dataset.hl || !lang) return;
      const html = highlight(code.textContent, lang);
      if (html != null) {
        code.innerHTML = html;
        code.dataset.hl = "1";
      }
    });
  }

  window.Highlight = { highlight, highlightAll, languages: Object.keys(LANGS) };
})();
