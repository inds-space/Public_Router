import notFoundHtml from "./404.html";
import rawRedirects from "./redirects.txt";
import { handleRequest } from "./router.js";

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, rawRedirects, notFoundHtml);
  },
};
