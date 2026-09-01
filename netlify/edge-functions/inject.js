// RELÓCTOUR — подставляет чат-виджет в HTML на сервере.
// Бандлер лендинга перерисовывает страницу и выкидывает обычные <script>,
// поэтому код виджета вшивается прямо в разметку, до того как она дойдёт до браузера.
 
export default async (request, context) => {
  const response = await context.next();
  const type = response.headers.get("content-type") || "";
 
  if (!type.includes("text/html")) return response;
 
  const html = await response.text();
  const patched = html.replace(
    "</body>",
    '<script src="/widget.js"></script></body>'
  );
 
  return new Response(patched, {
    status: response.status,
    headers: response.headers,
  });
};
 
export const config = { path: "/*" };
 
