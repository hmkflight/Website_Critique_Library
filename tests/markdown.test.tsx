import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "../src/components/ui";

describe("Markdown notes", () => {
  it("drops raw HTML and unsafe link schemes", () => {
    const html = renderToStaticMarkup(<Markdown>{"## Hi\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1)) [ok](https://example.com)"}</Markdown>);
    expect(html).toContain("<h2>Hi</h2>");
    expect(html).not.toMatch(/<script|onerror|javascript:/i);
    expect(html).toContain('href="https://example.com"');
  });
});
