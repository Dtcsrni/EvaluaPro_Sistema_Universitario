# GitHub Actions fijadas por SHA

Referencias verificadas contra la API Git de los repositorios oficiales el 2026-10-04.
Los workflows conservan el tag legible como comentario y ejecutan el commit objetivo de 40 caracteres.

| Repositorio oficial | Tag | Commit fijado | Evidencia oficial |
|---|---|---|---|
| `actions/checkout` | `v6` | `d23441a48e516b6c34aea4fa41551a30e30af803` | [API GitHub](https://api.github.com/repos/actions/checkout/git/ref/tags/v6) |
| `actions/setup-node` | `v6` | `249970729cb0ef3589644e2896645e5dc5ba9c38` | [API GitHub](https://api.github.com/repos/actions/setup-node/git/ref/tags/v6) |
| `actions/upload-artifact` | `v6` | `b7c566a772e6b6bfb58ed0dc250532a479d7789f` | [API GitHub](https://api.github.com/repos/actions/upload-artifact/git/ref/tags/v6) |
| `actions/setup-dotnet` | `v4` | `67a3573c9a986a3f9c594539f4ab511d57bb3ce9` | [API GitHub](https://api.github.com/repos/actions/setup-dotnet/git/ref/tags/v4) |
| `docker/login-action` | `v3` | `c94ce9fb468520275223c153574b00df6fe4bcc9` | [API GitHub](https://api.github.com/repos/docker/login-action/git/ref/tags/v3) |
| `actions/download-artifact` | `v6` | `018cc2cf5baa6db3ef3c5f8a56943fffe632ef53` | [API GitHub](https://api.github.com/repos/actions/download-artifact/git/ref/tags/v6) |
| `softprops/action-gh-release` | `v2` | `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65` | [API GitHub](https://api.github.com/repos/softprops/action-gh-release/git/ref/tags/v2) |
| `actions/configure-pages` | `v5` | `983d7736d9b0ae728b81ab479565c72886d7745b` | [API GitHub](https://api.github.com/repos/actions/configure-pages/git/ref/tags/v5) |
| `actions/upload-pages-artifact` | `v3` | `56afc609e74202658d3ffba0e8f6dda462b719fa` | [API GitHub](https://api.github.com/repos/actions/upload-pages-artifact/git/ref/tags/v3) |
| `actions/deploy-pages` | `v4` | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` | [API GitHub](https://api.github.com/repos/actions/deploy-pages/git/ref/tags/v4) |
| `github/codeql-action` | `v3` | `1190a975f95ce23525efb6a3fc21ea29567c1b52` | [API GitHub](https://api.github.com/repos/github/codeql-action/git/ref/tags/v3) |

`github/codeql-action@v3` es un tag anotado. Se usó su commit objetivo confirmado por el repositorio oficial. La respuesta del tag no ofrecía firma verificada; el SHA fija el commit, pero no afirma la firma del tag.
