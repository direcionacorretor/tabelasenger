# Portfólio Comercial — Construtora Senger

Versão funcional criada a partir do projeto `tabelasenger-main`.

## O que esta versão entrega

- Página inicial institucional e responsiva.
- Catálogo dos 10 empreendimentos cadastrados.
- Busca por empreendimento, unidade, cidade e características.
- Filtros por categoria, cidade, etapa e faixa de valor.
- Ordenação por destaque, preço, nome e quantidade de opções.
- Página individual de cada empreendimento.
- Galeria de imagens e plantas.
- Vídeos, mapas e folders quando cadastrados.
- Tabela de apartamentos e salas.
- Cards específicos para terrenos e outros imóveis.
- Seleção de várias opções para atendimento.
- Compartilhamento pelo WhatsApp com preços ou sem preços.
- Modo para ocultar preços na tela.
- Impressão e geração de PDF pelo navegador.
- PWA instalável e cache básico para uso recorrente.
- Layout adaptado para computador e celular.

## Atenção aos dados comerciais

Os valores e disponibilidades permanecem exatamente como estavam no arquivo-base.

- Tabela indicada no sistema: **Junho / 2026**
- Data indicada no sistema: **01/06/2026**

Antes de encaminhar o portfólio aos corretores, confira preços, reservas, vendas e condições comerciais no arquivo `data.js`.

## Onde atualizar os dados

Todas as informações comerciais estão centralizadas no arquivo:

```text
data.js
```

No início do arquivo ficam os dados gerais:

- mês da tabela;
- data da atualização;
- INCC;
- telefones;
- WhatsApp;
- Instagram;
- site;
- endereço.

Em `EMPREENDIMENTOS` ficam as informações de cada empreendimento, grupos e unidades.

## Publicação no GitHub Pages

1. Envie o conteúdo desta pasta para a raiz do repositório.
2. No GitHub, abra **Settings → Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Selecione a branch `main` e a pasta `/root`.
5. Salve e aguarde a publicação.

Não é necessário instalar dependências ou executar compilação.

## Arquivos principais

- `index.html`: estrutura da interface.
- `styles.css`: identidade visual e responsividade.
- `app.js`: filtros, páginas, compartilhamento e seleção.
- `data.js`: dados comerciais.
- `manifest.json`: instalação como aplicativo.
- `sw.js`: cache básico da PWA.
- `assets/`: imagens, plantas, logos e folders.

## Próxima evolução recomendada

A próxima etapa deve ser uma área administrativa com login e banco de dados, para alterar preço e disponibilidade sem editar código. Esta versão ainda é estática: alterações em `data.js` precisam ser publicadas novamente no GitHub.
