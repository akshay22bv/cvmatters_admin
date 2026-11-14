/** Blog body markdown ↔ HTML for the admin rich editor. */

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function inlineToHtml(text: string) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    return `<a href="${escapeAttr(href)}">${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  out = out.replace(/\+\+([^+]+)\+\+/g, "<u>$1</u>");
  return out;
}

export function markdownToHtml(text: string) {
  if (!text.trim()) return "";
  const lines = text.split("\n");
  const out: string[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    out.push(`<ul>${bullets.map((item) => `<li>${inlineToHtml(item)}</li>`).join("")}</ul>`);
    bullets = [];
  };

  const flushNumbers = () => {
    if (!numbers.length) return;
    out.push(`<ol>${numbers.map((item) => `<li>${inlineToHtml(item)}</li>`).join("")}</ol>`);
    numbers = [];
  };

  const flushLists = () => {
    flushBullets();
    flushNumbers();
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushLists();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineToHtml(heading[2])}</h${level}>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushNumbers();
      bullets.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flushBullets();
      numbers.push(line.replace(/^\d+\.\s+/, ""));
      continue;
    }
    flushLists();
    if (line.trim()) out.push(`<p>${inlineToHtml(line)}</p>`);
  }
  flushLists();
  return out.join("");
}

function inlineFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = [...el.childNodes].map(inlineFromNode).join("");
  if (tag === "strong" || tag === "b") return `**${inner}**`;
  if (tag === "em" || tag === "i") return `*${inner}*`;
  if (tag === "u") return `++${inner}++`;
  if (tag === "s" || tag === "strike" || tag === "del") return `~~${inner}~~`;
  if (tag === "code") return `\`${inner}\``;
  if (tag === "a") {
    const href = el.getAttribute("href") || "";
    return href ? `[${inner}](${href})` : inner;
  }
  if (tag === "br") return "\n";
  return inner;
}

export function htmlToMarkdown(root: HTMLElement) {
  const lines: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || "").replace(/\u00a0/g, " ").trim();
      if (text) lines.push(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "ul") {
      for (const item of el.querySelectorAll(":scope > li")) {
        lines.push(`- ${[...item.childNodes].map(inlineFromNode).join("").trim()}`);
      }
      return;
    }
    if (tag === "ol") {
      let index = 1;
      for (const item of el.querySelectorAll(":scope > li")) {
        lines.push(`${index}. ${[...item.childNodes].map(inlineFromNode).join("").trim()}`);
        index += 1;
      }
      return;
    }
    if (tag === "h1" || tag === "h2" || tag === "h3") {
      const level = Number(tag[1]);
      const text = [...el.childNodes].map(inlineFromNode).join("").trim();
      if (text) lines.push(`${"#".repeat(level)} ${text}`);
      return;
    }
    if (tag === "p" || tag === "div") {
      const text = [...el.childNodes].map(inlineFromNode).join("").trim();
      if (text) lines.push(text);
      return;
    }
    if (tag === "br") {
      lines.push("");
      return;
    }
    const text = [...el.childNodes].map(inlineFromNode).join("").trim();
    if (text) lines.push(text);
  };

  for (const child of root.childNodes) walk(child);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
