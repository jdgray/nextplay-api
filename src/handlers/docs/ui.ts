import type { ApiHandler } from '../../lib/http';

const HTML = `<!doctype html>
<html>
  <head>
    <title>NextPlay API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '/docs/openapi.yaml',
          dom_id: '#swagger-ui',
        });
      };
    </script>
  </body>
</html>`;

export const handler: ApiHandler = async () => ({
  statusCode: 200,
  headers: { 'content-type': 'text/html' },
  body: HTML,
});
