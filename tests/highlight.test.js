const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT } = require("./helpers/harness");

global.window = {};
new Function("window", fs.readFileSync(path.join(ROOT, "js", "highlight.js"), "utf8"))(global.window);
const H = global.window.Highlight;
const has = (out, ...bits) => bits.forEach((b) => assert.ok(out.includes(b), `missing ${b}\n${out}`));

describe("syntax highlighter", () => {
  test("C", () => has(H.highlight('#include <stdio.h>\n// vuln\nint main(void){ char buf[64]; gets(buf); if (x == 0x41) return 0; }', "c"),
    '<span class="hl-p">#include &lt;stdio.h&gt;</span>', '<span class="hl-c">// vuln</span>', '<span class="hl-t">char</span>', '<span class="hl-k">if</span>', '<span class="hl-f">gets</span>', '<span class="hl-n">0x41</span>'));
  test("Python (pwntools)", () => has(H.highlight('from pwn import *\nio = remote("x", 1337)  # target\npayload = b"A"*72 + p64(0xdeadbeef)\n@deco\ndef f(): pass', "python"),
    '<span class="hl-k">from</span>', '<span class="hl-s">"x"</span>', '<span class="hl-c"># target</span>', '<span class="hl-t">p64</span>', '<span class="hl-n">0xdeadbeef</span>', '<span class="hl-p">@deco</span>'));
  test("x86 assembly", () => has(H.highlight("_start:\n  mov rax, 0x3b ; execve\n  xor rdi, rdi\n  syscall", "nasm"),
    '<span class="hl-f">_start:</span>', '<span class="hl-k">mov</span>', '<span class="hl-r">rax</span>', '<span class="hl-n">0x3b</span>', '<span class="hl-c">; execve</span>', '<span class="hl-k">syscall</span>'));
  test("JSON separates keys from values", () => has(H.highlight('{"flag": "x", "n": 5, "ok": true}', "json"),
    '<span class="hl-a">"flag"</span>', '<span class="hl-s">"x"</span>', '<span class="hl-n">5</span>', '<span class="hl-k">true</span>'));
  test("diff", () => has(H.highlight("@@ -1,2 +1,2 @@\n-old\n+new\n ctx", "diff"), '<span class="hl-p">@@ -1,2 +1,2 @@</span>', '<span class="hl-del">-old</span>', '<span class="hl-add">+new</span>'));
  test("shell", () => has(H.highlight('gcc -o x x.c -fno-stack-protector\ncat $FILE # hi', "bash"),
    '<span class="hl-a">-o</span>', '<span class="hl-a">-fno-stack-protector</span>', '<span class="hl-v">$FILE</span>', '<span class="hl-c"># hi</span>'));
  test("Rust, Go, Java, SQL, CSS, YAML, HTML all tokenise", () => {
    for (const [lang, src, cls] of [["rust", "fn main() { let x: u32 = 5; println!(\"a\"); }", "hl-k"], ["go", "func main() { x := 1 }", "hl-k"], ["java", "public class A { int x; }", "hl-k"],
      ["sql", "SELECT * FROM users WHERE id = 1 -- x", "hl-k"], ["css", "a { color: #fff; margin: 0px }", "hl-a"], ["yaml", "name: x\nok: true", "hl-a"], ["html", '<a href="x">y</a>', "hl-k"]])
      assert.ok(H.highlight(src, lang).includes(cls), lang);
  });
  test("aliases", () => {
    for (const a of ["py", "js", "ts", "sh", "asm", "rs", "golang", "yml", "c++", "x86", "patch", "zsh"]) assert.ok(H.languages.includes(a), a);
  });
  test("markup inside code is escaped, never live", () => {
    for (const lang of ["python", "html", "c", "bash", "json"]) {
      const out = H.highlight('x = "<img src=x onerror=alert(1)>" <script>alert(1)</script>', lang);
      assert.ok(!/<img|<script/.test(out), lang);
    }
  });
  test("unknown or missing language -> left alone", () => {
    assert.equal(H.highlight("hi", "nonsense"), null);
    assert.equal(H.highlight("hi", ""), null);
  });
  test("highlighting never changes the text itself", () => {
    const src = '#include <x>\nint a = "s<>&"; // c\n';
    const back = H.highlight(src, "c").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    assert.equal(back, src);
  });
  test("pathological input stays fast; huge blocks are skipped", () => {
    const nasty = '"open string \\\\ /* open comment '.repeat(1200).slice(0, 39000);
    const t0 = Date.now();
    for (const l of ["c", "python", "js", "asm", "bash"]) H.highlight(nasty, l);
    assert.ok(Date.now() - t0 < 800, "took " + (Date.now() - t0) + "ms");
    assert.equal(H.highlight("x".repeat(50000), "c"), null);
  });
});
