/* ============================================================
   Senger — Tabela de Preços online · render + filtros + modal
   ============================================================ */
(function () {
  const { META, EMPREENDIMENTOS, LOCAIS = {} } = window.SENGER;
  const WA = META.contato.whatsapp;

  // ---------- helpers ----------
  const fmtBRL = (n) =>
    "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const fmtBRLshort = (n) => "R$ " + n.toLocaleString("pt-BR");
  const STATUS_LABEL = {
    disponivel: "Disponível",
    alugado: "Alugado",
    reservado: "Reservado",
    vendido: "Vendido",
  };
  // Rótulo da unidade: prefixa "Apto"/"Sala" só quando o código é numérico;
  // rótulos textuais (ex.: "Sala 04") são exibidos como estão.
  const aptoLabel = (emp, u) =>
    /^\d/.test(String(u.apto))
      ? (emp.categoria === "comercial" ? "Sala " : "Apto ") + u.apto
      : u.apto;
  // Preço com tratamento para unidades sem valor (vendidas/sob consulta).
  const fmtPreco = (n) => (n ? fmtBRL(n) : "—");
  const CAT_LABEL = {
    residencial: "Residencial",
    comercial: "Comercial",
    terreno: "Terrenos",
    outros: "Outros",
  };
  function waLink(msg) {
    return `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
  }
  // link para ENCAMINHAR o produto a um cliente (abre direto no empreendimento)
  function shareWaHref(emp) {
    const url = location.origin + location.pathname + "#emp-" + emp.id;
    const msg = `${emp.nome} — Construtora Senger (${emp.cidade})\nVeja os valores e a disponibilidade:\n${url}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  // classify media into fotos / plantas / mapas
  function splitMedia(emp) {
    const fotos = [],
      plantas = [],
      mapas = [];
    if (emp.hero) fotos.push({ src: emp.hero, legenda: emp.nome });
    (emp.galeria || []).forEach((g) => {
      const l = (g.legenda || "").toLowerCase();
      const s = (g.src || "").toLowerCase();
      if (l.includes("planta") || l.includes("urbanismo") || l.includes("lotes")) plantas.push(g);
      else if (l.includes("mapa") || l.includes("localiz") || l.includes("praça") || s.includes("-map") || s.includes("-mapa")) mapas.push(g);
      else fotos.push(g);
    });
    return { fotos, plantas, mapas };
  }
  // all photos (for unit modal gallery)
  function empMedia(emp) {
    const { fotos, plantas } = splitMedia(emp);
    return fotos.concat(plantas);
  }

  // ---------- state ----------
  const state = {
    cat: "todos",
    cidade: "todas",
    status: "todos",
    faixa: "todas",
    q: "",
  };

  // ---------- build header / hero ----------
  document.getElementById("incc-val").innerHTML =
    `${META.incc.valor} <span>${META.incc.variacao}</span>`;
  document.getElementById("hero-mes").textContent = META.mesTabela;
  document.getElementById("hero-data").textContent = META.dataTabela;

  // count totals
  let totalUnid = 0,
    totalDisp = 0,
    dispAptos = 0,
    dispTerrenos = 0;
  EMPREENDIMENTOS.forEach((e) => {
    (e.grupos || []).forEach((g) =>
      g.unidades.forEach((u) => {
        totalUnid++;
        if (u.status !== "vendido" && u.status !== "reservado") { totalDisp++; dispAptos++; }
      })
    );
    (e.terrenos || []).forEach((t) => {
      totalUnid++;
      if ((t.status || "disponivel") !== "vendido") { totalDisp++; dispTerrenos++; }
    });
    (e.outros || []).forEach((o) => {
      totalUnid++;
      if (o.status !== "vendido" && o.status !== "reservado") { totalDisp++; dispAptos++; }
    });
  });
  document.getElementById("hero-unid").textContent = dispAptos + " aptos · " + dispTerrenos + " terrenos";

  // institutional strip under masthead
  const setTxt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setTxt("ms-mes", META.mesTabela);
  setTxt("ms-aptos", dispAptos);
  setTxt("ms-terrenos", dispTerrenos);
  setTxt("ms-incc", META.incc.variacao);

  // ---------- contact buttons ----------
  const waGeneral = waLink(
    "Olá! Vi a tabela de preços online da Senger e gostaria de mais informações."
  );
  document.getElementById("btn-contact").onclick = () =>
    window.open(waGeneral, "_blank");
  document.getElementById("wa-float").onclick = () =>
    window.open(waGeneral, "_blank");

  // ---------- render empreendimentos ----------
  const main = document.getElementById("emp-list");

  function unitTile(emp, grupo, u) {
    const area = u.areaUnit || grupo.area;
    const tags = (u.tags || [])
      .map((t) => `<span class="utag">${t}</span>`)
      .join("");
    const tile = el(`
      <button class="unit" data-status="${u.status}" data-price="${u.preco}"
        data-search="${(emp.nome + " " + grupo.tipo + " " + u.apto + " " + emp.cidade).toLowerCase()}">
        <span class="u-apto">${aptoLabel(emp, u)}</span>
        <span class="u-price">${fmtPreco(u.preco)}</span>
        <span class="u-area">${area}</span>
        <span class="u-foot">
          <span class="st st-${u.status}">${STATUS_LABEL[u.status]}</span>
          ${tags}
        </span>
      </button>`);
    tile.addEventListener("click", () => openModal(emp, grupo, u));
    return tile;
  }

  // Mapa verificado de planta por empreendimento (conferido pelas áreas
  // impressas em cada planta). Evolutti tem 2 plantas (2 dorm / 3 dorm).
  // Um grupo pode sobrescrever com g.planta (nome do arquivo, sem caminho).
  const PLANTA_BY_EMP = {
    prime: () => "prime-planta",
    personalite: () => "perso-planta",
    boulevard: () => "bv-planta",
    "premium-office": () => "po-planta",
    evolutti: (g) => (/3\s*dorm/i.test(g.tipo) ? "evo-p3" : "evo-p2"),
  };
  function plantaForGrupo(emp, plantas, g) {
    if (!plantas || !plantas.length) return null;
    let key = g.planta;
    if (!key && PLANTA_BY_EMP[emp.id]) key = PLANTA_BY_EMP[emp.id](g);
    if (!key) return null;
    key = key.replace(/^assets\//, "").replace(/\.[a-z]+$/i, "");
    const i = plantas.findIndex(
      (p) => p.src.split("/").pop().replace(/\.[a-z]+$/i, "") === key
    );
    return i >= 0 ? { planta: plantas[i], idx: i } : null;
  }

  function renderEmp(emp) {
    const sec = el(`<section class="emp" id="emp-${emp.id}" data-cat="${emp.categoria}" data-cidade="${emp.cidade}"></section>`);

    // banner
    const statusCls = emp.status === "pronto" ? "status-pronto" : "status-obra";
    const banner = el(`
      <div class="emp-banner ${emp.hero ? "" : "noimg"}">
        ${emp.hero ? `<div class="banner-media"><img class="bg" src="${emp.hero}" alt="${emp.nome}">${emp.logo ? `<img class="emp-logo" src="${emp.logo}" alt="${emp.nome}">` : ""}</div>` : ""}
        <div class="emp-banner-content">
          <div class="emp-badges">
            <span class="badge cidade">${emp.cidade}</span>
            <span class="badge ${statusCls}">${emp.statusLabel}</span>
            ${emp.categoria === "comercial" ? '<span class="badge">Comercial</span>' : ""}
          </div>
          <h2>${emp.nome}</h2>
          ${emp.tagline ? `<p class="emp-tagline">"${emp.tagline}"</p>` : ""}
          ${emp.ri && emp.ri.length ? `<div class="emp-ri">${emp.ri.map((r) => `<span>${r}</span>`).join("")}</div>` : ""}
          <a class="btn-share-wa" target="_blank" rel="noopener" href="${shareWaHref(emp)}">${waSvg()} Enviar por WhatsApp</a>
        </div>
      </div>`);
    sec.appendChild(banner);

    const body = el(`<div class="emp-body"></div>`);

    // diferenciais
    if (emp.diferenciais && emp.diferenciais.length) {
      const strip = el(`<div class="dif-strip"></div>`);
      emp.diferenciais.forEach((d) =>
        strip.appendChild(
          el(`<div class="dif"><div class="di">${difIcon(d.titulo)}</div><div class="dt">${d.titulo}</div><div class="dd">${d.desc}</div></div>`)
        )
      );
      body.appendChild(strip);
    }
    // localizacao
    if (emp.localizacao) {
      body.appendChild(
        el(`<div class="emp-loc">${pinSvg()}<span>${emp.localizacao}</span></div>`)
      );
    }
    if (emp.condicoes && !emp.consulta) {
      body.appendChild(el(`<div class="emp-cond">${emp.condicoes}</div>`));
    }

    // grupos de unidades
    if (emp.grupos && emp.grupos.length) {
      const plantasEmp = splitMedia(emp).plantas;
      const gw = el(`<div class="grupos"></div>`);
      emp.grupos.forEach((g) => {
        const pf = plantaForGrupo(emp, plantasEmp, g);
        const gEl = el(`
          <div class="grupo">
            <div class="grupo-head">
              <div class="gh-text">
                <span class="gt">${g.tipo}</span>
                ${g.area ? `<span class="ga">${g.area}</span>` : ""}
                ${g.garagem ? `<span class="gg">${g.garagem}</span>` : ""}
              </div>
              ${pf ? `<button class="grupo-planta" type="button" aria-label="Ver planta ampliada" title="Ver planta ampliada">
                <img src="${pf.planta.src}" alt="Planta — ${g.tipo}">
                <span class="gp-label">Ver planta</span>
              </button>` : ""}
            </div>
            ${g.obs ? `<div class="grupo-obs">${g.obs}</div>` : ""}
            <div class="units"></div>
          </div>`);
        if (pf) {
          gEl.querySelector(".grupo-planta").addEventListener("click", (e) => {
            e.stopPropagation();
            openLightbox(plantasEmp, pf.idx);
          });
        }
        const uw = gEl.querySelector(".units");
        g.unidades.forEach((u) => uw.appendChild(unitTile(emp, g, u)));
        gw.appendChild(gEl);
      });
      body.appendChild(gw);
    }

    // consulta (Boulevard)
    if (emp.consulta) {
      const c = el(`
        <div class="consulta">
          <div>
            <div class="ct">Unidades sob consulta</div>
            <div class="cd">${emp.condicoes || "Entre em contato para conhecer as unidades disponíveis."}</div>
          </div>
          <a class="btn-ghost btn-wa" target="_blank" href="${waLink(
            `Olá! Tenho interesse no ${emp.nome} (${emp.cidade}). Pode me enviar os valores e disponibilidade?`
          )}">${waSvg()} Consultar no WhatsApp</a>
        </div>`);
      body.appendChild(c);
    }

    // terrenos
    if (emp.terrenos && emp.terrenos.length) {
      const tbl = el(`
        <div class="ter-table">
          <div class="ter-row head">
            <span>Quadra / Lote</span><span>Rua</span><span>Área</span><span>Valor</span><span></span>
          </div>
        </div>`);
      emp.terrenos.forEach((t) => {
        const st = t.status || "disponivel";
        const vendido = st === "vendido";
        const acao = vendido
          ? `<span class="st st-vendido ta">Vendido</span>`
          : `<a class="btn-ghost btn-wa ta" target="_blank" href="${waLink(
              `Olá! Tenho interesse no terreno ${t.lote ? t.lote + " — " : ""}Quadra ${t.quadra} Lote ${t.numero} (${t.rua})${t.area ? ", " + t.area + "m²" : ""}${t.preco ? " — " + fmtBRLshort(t.preco) : ""}.`
            )}">${waSvg()} Interesse</a>`;
        const row = el(`
          <div class="ter-row" data-status="${st}" data-price="${t.preco || 0}"
            data-search="${((t.lote || "") + " " + t.rua + " quadra " + t.quadra + " lote " + t.numero + " terreno").toLowerCase()}">
            <span class="tl">Q ${t.quadra} · Lote ${t.numero}${t.lote ? `<span class="tl-sub">${t.lote}</span>` : ""}</span>
            <span class="tc">${t.rua}</span>
            <span class="tc">${t.area ? t.area.toLocaleString("pt-BR") + " m²" : "—"}</span>
            <span class="tp">${t.preco ? fmtBRL(t.preco) : "—"}</span>
            ${acao}
          </div>`);
        tbl.appendChild(row);
      });
      body.appendChild(tbl);
    }

    // outros imóveis
    if (emp.outros && emp.outros.length) {
      const grid = el(`<div class="outros-grid"></div>`);
      emp.outros.forEach((o) => {
        const card = el(`
          <div class="outro-card" data-status="${o.status}" data-price="${o.preco}"
            data-search="${(o.nome + " " + o.local + " " + o.descricao).toLowerCase()}">
            <div class="ol">${o.local}</div>
            <h3>${o.nome}</h3>
            <div class="od">${o.descricao}</div>
            <div class="oa">${o.area}</div>
            <div class="of">
              <div class="op">${o.precoPrefixo ? `<small>${o.precoPrefixo}</small>` : ""}${fmtBRL(o.preco)}</div>
              <span class="st st-${o.status}">${STATUS_LABEL[o.status]}</span>
            </div>
            ${o.obs ? `<div class="modal-obs" style="margin-top:10px">${o.obs}</div>` : ""}
            <div class="emp-actions" style="margin-top:16px">
              <a class="btn-ghost btn-wa" target="_blank" href="${waLink(
                `Olá! Tenho interesse no imóvel ${o.nome} (${o.local}) — ${fmtBRLshort(o.preco)}.`
              )}">${waSvg()} Tenho interesse</a>
            </div>
          </div>`);
        grid.appendChild(card);
      });
      body.appendChild(grid);
    }

    // localização (mapa + link Google Maps)
    const { fotos, plantas, mapas } = splitMedia(emp);
    const loc = LOCAIS[emp.id] || {};
    if (mapas.length || loc.mapsUrl) {
      const locBox = el(`<div class="emp-block"></div>`);
      locBox.appendChild(el(`<div class="block-title">${pinSvg()} Localização</div>`));
      if (mapas.length) {
        const mimg = el(`<img class="loc-map" src="${mapas[0].src}" alt="Mapa ${emp.nome}">`);
        mimg.addEventListener("click", () => openLightbox(mapas, 0));
        locBox.appendChild(mimg);
      }
      if (emp.localizacao) locBox.appendChild(el(`<div class="loc-addr">${emp.localizacao}</div>`));
      if (loc.mapsUrl)
        locBox.appendChild(
          el(`<a class="btn-ghost" target="_blank" href="${loc.mapsUrl}">${pinSvg()} Abrir no Google Maps</a>`)
        );
      body.appendChild(locBox);
    }

    // (bloco de vídeo removido a pedido)

    // ações: ver fotos / ver planta
    if (fotos.length || plantas.length || emp.folder) {
      const act = el(`<div class="emp-actions"></div>`);
      if (emp.folder) {
        act.appendChild(
          el(`<a class="btn-ghost btn-folder" href="${emp.folder}" target="_blank" rel="noopener" download>${pdfSvg()} Baixar folder (PDF)</a>`)
        );
      }
      if (fotos.length) {
        const b = el(`<button class="btn-ghost">${galSvg()} Ver fotos (${fotos.length})</button>`);
        b.addEventListener("click", () => openLightbox(fotos, 0));
        act.appendChild(b);
      }
      if (plantas.length) {
        const b = el(`<button class="btn-ghost btn-planta">${planSvg()} Ver planta (${plantas.length})</button>`);
        b.addEventListener("click", () => openLightbox(plantas, 0));
        act.appendChild(b);
      }
      body.appendChild(act);
    }

    const backBtm = el(`<button class="btn-back btn-back-btm">${"<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><path d=\"M15 18l-6-6 6-6\"/></svg>"} Voltar aos empreendimentos</button>`);
    backBtm.addEventListener("click", showHome);
    body.appendChild(backBtm);

    sec.appendChild(body);
    return sec;
  }

  EMPREENDIMENTOS.forEach((e) => main.appendChild(renderEmp(e)));

  // ---------- quick nav cards ----------
  const qn = document.getElementById("quicknav");
  function empDisponiveis(emp) {
    let n = 0;
    (emp.grupos || []).forEach((g) =>
      g.unidades.forEach((u) => u.status !== "vendido" && u.status !== "reservado" && n++)
    );
    (emp.terrenos || []).forEach((t) => {
      if ((t.status || "disponivel") !== "vendido") n++;
    });
    (emp.outros || []).forEach((o) => o.status !== "vendido" && o.status !== "reservado" && n++);
    return n;
  }
  function empMinPreco(emp) {
    let min = Infinity;
    (emp.grupos || []).forEach((g) =>
      g.unidades.forEach((u) => {
        if (u.status !== "vendido" && u.status !== "reservado" && u.preco) min = Math.min(min, u.preco);
      })
    );
    (emp.terrenos || []).forEach((t) => {
      if ((t.status || "disponivel") !== "vendido" && t.preco) min = Math.min(min, t.preco);
    });
    (emp.outros || []).forEach((o) => {
      if (o.status !== "vendido" && o.status !== "reservado" && o.preco) min = Math.min(min, o.preco);
    });
    return min === Infinity ? null : min;
  }
  EMPREENDIMENTOS.forEach((emp) => {
    const thumb = emp.hero || (emp.galeria && emp.galeria[0] && emp.galeria[0].src);
    const disp = empDisponiveis(emp);
    const isOutros = emp.outros && emp.outros.length;
    const cnt = isOutros ? emp.outros.length : disp;
    const countLabel = emp.consulta
      ? "Sob consulta"
      : isOutros
      ? `${emp.outros.length} ${emp.outros.length === 1 ? "imóvel" : "imóveis"}`
      : disp + (disp === 1 ? " disponível" : " disponíveis");
    const stCls = emp.status === "pronto" ? "pronto" : "obra";
    const minPreco = empMinPreco(emp);
    const catLabel = emp.categoria === "terreno" ? "Terrenos" : emp.categoria === "comercial" ? "Salas comerciais" : "Apartamentos";
    const card = el(`
      <button class="qn-card" data-target="emp-${emp.id}">
        <div class="qn-thumb">
          ${thumb ? `<img src="${thumb}" alt="${emp.nome}">` : `<div class="qn-noimg">${catLabel}</div>`}
          <span class="qn-st ${stCls}">${emp.statusLabel}</span>
        </div>
        <div class="qn-body">
          <div class="qn-name">${emp.nome}</div>
          <div class="qn-city">${emp.cidade}</div>
          <div class="qn-foot">
            ${minPreco ? `<div class="qn-price"><span>a partir de</span><strong>${fmtBRL(minPreco)}</strong></div>` : `<div class="qn-price consulta"><strong>Sob consulta</strong></div>`}
            <div class="qn-count ${cnt ? "" : "zero"}">${countLabel}</div>
          </div>
        </div>
      </button>`);
    card.dataset.empId = emp.id;
    card.dataset.cat = emp.categoria;
    card.dataset.cidade = emp.cidade;
    card.dataset.search = (emp.nome + " " + emp.cidade).toLowerCase();
    card.addEventListener("click", () => showDetail(emp.id));
    qn.appendChild(card);
  });

  // ---------- home / detail view ----------
  const backBar = document.getElementById("back-bar");
  const backTitle = document.getElementById("back-title");
  function showDetail(id) {
    const emp = EMPREENDIMENTOS.find((e) => e.id === id);
    if (!emp) return;
    document.body.classList.add("detail-mode");
    EMPREENDIMENTOS.forEach((e) =>
      document.getElementById("emp-" + e.id).classList.toggle("active-detail", e.id === id)
    );
    backTitle.textContent = emp.nome;
    try { history.replaceState(null, "", "#emp-" + id); } catch (e) {}
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function showHome() {
    document.body.classList.remove("detail-mode");
    EMPREENDIMENTOS.forEach((e) =>
      document.getElementById("emp-" + e.id).classList.remove("active-detail")
    );
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  document.getElementById("btn-back").addEventListener("click", showHome);

  // abre direto um empreendimento se a URL tiver #emp-<id> (link compartilhado)
  (function openFromHash() {
    const m = (location.hash || "").match(/^#emp-(.+)$/);
    if (m && EMPREENDIMENTOS.some((e) => e.id === m[1])) showDetail(m[1]);
  })();

  // ---------- filters UI ----------
  // build cidade chips dynamically
  const cidades = [...new Set(EMPREENDIMENTOS.map((e) => e.cidade.split(" · ")).flat())];
  // simpler: unique by full string of residential/comercial
  const cidadeSet = [...new Set(EMPREENDIMENTOS.map((e) => e.cidade))];
  const cidadeBox = document.getElementById("cidade-chips");
  function makeChip(label, val, group) {
    const c = el(`<button class="chip" data-group="${group}" data-val="${val}">${label}</button>`);
    if (
      (group === "cidade" && val === state.cidade) ||
      (group === "status" && val === state.status)
    )
      c.classList.add("active");
    c.addEventListener("click", () => {
      state[group] = val;
      document
        .querySelectorAll(`.chip[data-group="${group}"]`)
        .forEach((x) => x.classList.toggle("active", x.dataset.val === val));
      applyFilters();
    });
    return c;
  }
  cidadeBox.appendChild(makeChip("Todas as cidades", "todas", "cidade"));
  cidadeSet
    .filter((c) => !c.includes("·"))
    .forEach((c) => cidadeBox.appendChild(makeChip(c, c, "cidade")));

  const statusBox = document.getElementById("status-chips");
  statusBox.appendChild(makeChip("Todos", "todos", "status"));
  [["disponivel", "Disponível"], ["alugado", "Alugado"]].forEach(([v, l]) =>
    statusBox.appendChild(makeChip(l, v, "status"))
  );

  // category segmented
  document.querySelectorAll(".seg button").forEach((b) => {
    b.addEventListener("click", () => {
      state.cat = b.dataset.cat;
      document
        .querySelectorAll(".seg button")
        .forEach((x) => x.classList.toggle("active", x === b));
      applyFilters();
    });
  });

  // search + faixa
  document.getElementById("search-input").addEventListener("input", (e) => {
    state.q = e.target.value.toLowerCase().trim();
    applyFilters();
  });
  document.getElementById("faixa-select").addEventListener("change", (e) => {
    state.faixa = e.target.value;
    applyFilters();
  });
  document.getElementById("btn-clear").addEventListener("click", () => {
    state.cat = "todos";
    state.cidade = "todas";
    state.status = "todos";
    state.faixa = "todas";
    state.q = "";
    document.getElementById("search-input").value = "";
    document.getElementById("faixa-select").value = "todas";
    document.querySelectorAll(".seg button").forEach((x) =>
      x.classList.toggle("active", x.dataset.cat === "todos")
    );
    document.querySelectorAll(".chip").forEach((x) =>
      x.classList.toggle(
        "active",
        x.dataset.val === "todas" || x.dataset.val === "todos"
      )
    );
    applyFilters();
  });

  const FAIXAS = {
    todas: [0, Infinity],
    "0-300": [0, 300000],
    "300-600": [300000, 600000],
    "600-1000": [600000, 1000000],
    "1000+": [1000000, Infinity],
  };

  // ---------- apply filters (filtra os cards da home) ----------
  function priceMatch(price) {
    const [lo, hi] = FAIXAS[state.faixa];
    return price >= lo && price <= hi;
  }
  // pré-computa as unidades de cada empreendimento
  const UNITS = {};
  EMPREENDIMENTOS.forEach((emp) => {
    const arr = [];
    (emp.grupos || []).forEach((g) =>
      g.unidades.forEach((u) =>
        arr.push({
          status: u.status,
          price: u.preco,
          search: (emp.nome + " " + g.tipo + " " + u.apto + " " + emp.cidade).toLowerCase(),
        })
      )
    );
    (emp.terrenos || []).forEach((t) =>
      arr.push({
        status: t.status || "disponivel",
        price: t.preco || 0,
        search: ((t.lote || "") + " " + t.rua + " q" + t.quadra + " l" + t.numero + " " + emp.cidade).toLowerCase(),
      })
    );
    (emp.outros || []).forEach((o) =>
      arr.push({ status: o.status, price: o.preco, search: (o.nome + " " + o.local).toLowerCase() })
    );
    if (!arr.length) arr.push({ status: "disponivel", price: 0, search: emp.nome.toLowerCase() });
    UNITS[emp.id] = arr;
  });

  function applyFilters() {
    let shown = 0;
    EMPREENDIMENTOS.forEach((emp) => {
      const card = qn.querySelector(`.qn-card[data-emp-id="${emp.id}"]`);
      if (!card) return;
      const catOk = state.cat === "todos" || emp.categoria === state.cat;
      const cidadeOk =
        state.cidade === "todas" || emp.cidade === state.cidade || emp.cidade.includes(state.cidade);
      const nameMatch =
        !state.q ||
        emp.nome.toLowerCase().includes(state.q) ||
        emp.cidade.toLowerCase().includes(state.q);
      const hasMatch = UNITS[emp.id].some((u) => {
        const sOk = state.status === "todos" || u.status === state.status;
        const pOk = priceMatch(u.price);
        const qOk = nameMatch || u.search.includes(state.q);
        return sOk && pOk && qOk;
      });
      const visible = catOk && cidadeOk && hasMatch;
      card.classList.toggle("hidden", !visible);
      if (visible) shown++;
    });
    document.getElementById("count").innerHTML = `<b>${shown}</b> empreendimento${shown === 1 ? "" : "s"}`;
    document.getElementById("empty").style.display = shown === 0 ? "block" : "none";
  }
  applyFilters();

  // ---------- modal ----------
  const modalBack = document.getElementById("modal-back");
  const modal = document.getElementById("modal");
  function openModal(emp, grupo, u) {
    const media = empMedia(emp);
    const area = u.areaUnit || grupo.area;
    const heroImg = emp.hero || (media[0] && media[0].src);
    const tags = (u.tags || []).map((t) => `<span class="utag">${t}</span>`).join(" ");
    const tipoLabel = emp.categoria === "comercial" ? "Sala" : "Apto";
    const unitLabel = aptoLabel(emp, u);
    const galThumbs = media
      .map(
        (m, i) =>
          `<img src="${m.src}" alt="${m.legenda || ""}" data-i="${i}">`
      )
      .join("");
    modal.innerHTML = `
      <div class="modal-hero">
        ${heroImg ? `<img src="${heroImg}" alt="${emp.nome}">` : ""}
        <button class="modal-close" aria-label="Fechar">✕</button>
        <div class="modal-hero-cap">
          <div class="me">${emp.cidade} · ${emp.statusLabel}</div>
          <h3>${emp.nome}</h3>
        </div>
      </div>
      <div class="modal-body">
        <div class="modal-facts">
          <div class="fact"><div class="fk">Unidade</div><div class="fv">${unitLabel}</div></div>
          <div class="fact"><div class="fk">Tipologia</div><div class="fv">${grupo.tipo}</div></div>
          <div class="fact"><div class="fk">Área</div><div class="fv">${area}</div></div>
          ${grupo.garagem ? `<div class="fact"><div class="fk">Garagem</div><div class="fv">${grupo.garagem}</div></div>` : ""}
          <div class="fact"><div class="fk">Valor</div><div class="fv price">${fmtPreco(u.preco)}</div></div>
          <div class="fact"><div class="fk">Situação</div><div class="fv"><span class="st st-${u.status}">${STATUS_LABEL[u.status]}</span> ${tags}</div></div>
        </div>
        ${grupo.obs ? `<div class="modal-obs">${grupo.obs}</div>` : ""}
        ${emp.condicoes ? `<div class="modal-obs">Condições de pagamento: ${emp.condicoes}</div>` : ""}
        ${media.length ? `<div class="modal-gallery">${galThumbs}</div>` : ""}
        <div class="modal-cta">
          <a class="btn-ghost btn-wa" target="_blank" href="${waLink(
            `Olá! Tenho interesse no ${unitLabel} do ${emp.nome} (${emp.cidade})${u.preco ? " — " + fmtBRLshort(u.preco) : ""}. Podemos conversar?`
          )}">${waSvg()} Tenho interesse neste ${tipoLabel.toLowerCase()}</a>
          <button class="btn-ghost" id="modal-gallery-btn">${galSvg()} Ver todas as imagens</button>
        </div>
      </div>`;
    modal.querySelector(".modal-close").onclick = closeModal;
    modal.querySelectorAll(".modal-gallery img").forEach((img) =>
      img.addEventListener("click", () => openLightbox(media, +img.dataset.i))
    );
    const gb = modal.querySelector("#modal-gallery-btn");
    if (gb) gb.onclick = () => (media.length ? openLightbox(media, 0) : null);
    modalBack.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    modalBack.classList.remove("open");
    if (!lightbox.classList.contains("open")) document.body.style.overflow = "";
  }
  modalBack.addEventListener("click", (e) => {
    if (e.target === modalBack) closeModal();
  });

  // ---------- lightbox ----------
  const lightbox = document.getElementById("lightbox");
  let lbList = [],
    lbIdx = 0;
  function openLightbox(list, i) {
    lbList = list;
    lbIdx = i;
    renderLb();
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function renderLb() {
    const m = lbList[lbIdx];
    lightbox.querySelector("img").src = m.src;
    lightbox.querySelector(".lb-cap").textContent =
      (m.legenda || "") + `  ·  ${lbIdx + 1}/${lbList.length}`;
  }
  function closeLb() {
    lightbox.classList.remove("open");
    if (!modalBack.classList.contains("open")) document.body.style.overflow = "";
  }
  lightbox.querySelector(".lb-close").onclick = closeLb;
  lightbox.querySelector(".lb-prev").onclick = () => {
    lbIdx = (lbIdx - 1 + lbList.length) % lbList.length;
    renderLb();
  };
  lightbox.querySelector(".lb-next").onclick = () => {
    lbIdx = (lbIdx + 1) % lbList.length;
    renderLb();
  };
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLb();
  });
  document.addEventListener("keydown", (e) => {
    if (lightbox.classList.contains("open")) {
      if (e.key === "Escape") closeLb();
      if (e.key === "ArrowLeft") lightbox.querySelector(".lb-prev").click();
      if (e.key === "ArrowRight") lightbox.querySelector(".lb-next").click();
    } else if (modalBack.classList.contains("open") && e.key === "Escape") {
      closeModal();
    }
  });

  // ---------- footer fill ----------
  const fc = document.getElementById("foot-contacts");
  META.contato.telefones.forEach((t) =>
    fc.appendChild(el(`<a href="tel:${t.replace(/\D/g, "")}">${t}</a>`))
  );
  const fl = document.getElementById("foot-links");
  fl.appendChild(el(`<a href="${waGeneral}" target="_blank">WhatsApp</a>`));
  fl.appendChild(
    el(`<a href="https://instagram.com/construtorasenger" target="_blank">${META.contato.instagram}</a>`)
  );
  fl.appendChild(
    el(`<a href="https://${META.contato.site}" target="_blank">${META.contato.site}</a>`)
  );
  document.getElementById("foot-endereco").textContent = META.contato.endereco;
  document.getElementById("foot-data").textContent =
    "Tabela " + META.mesTabela + " · atualizada em " + META.dataTabela;

  // ---------- svg icons ----------
  function waSvg() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.8 14.13c-.24.68-1.42 1.31-1.96 1.36-.5.05-.99.24-3.32-.7-2.79-1.13-4.55-3.99-4.69-4.18-.14-.19-1.13-1.5-1.13-2.86 0-1.36.71-2.03.96-2.31.25-.27.55-.34.73-.34.18 0 .37 0 .53.01.17.01.4-.06.62.48.24.55.81 1.91.88 2.05.07.14.12.3.02.49-.1.19-.14.3-.28.46-.14.16-.3.36-.42.49-.14.14-.29.29-.12.57.17.27.74 1.22 1.59 1.98 1.1.97 2.02 1.28 2.3 1.42.28.14.45.12.61-.07.16-.19.71-.82.9-1.1.19-.28.37-.23.62-.14.25.09 1.6.76 1.87.9.27.14.46.21.53.32.07.12.07.66-.17 1.34z"/></svg>`;
  }
  function pinSvg() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
  }
  function galSvg() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
  }
  function planSvg() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18M9 9v12M9 3v6"/></svg>`;
  }
  function playSvg() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M10 9l5 3-5 3z" fill="currentColor"/></svg>`;
  }
  function pdfSvg() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/></svg>`;
  }
  // ícone por diferencial (palavras-chave) — traço fino, herda a cor
  function difIcon(t) {
    const s = (t || "").toLowerCase();
    const I = {
      energia: '<path d="M12 3v2M5 8l1.5 1.5M19 8l-1.5 1.5M4 14h3M17 14h3"/><path d="M9 18a4 4 0 0 1 6 0"/><path d="M8 14a4 4 0 0 1 8 0z"/>',
      eletrico: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
      carro: '<path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13v5h-2v-2H7v2H5z"/><circle cx="7.5" cy="15.5" r="1.2"/><circle cx="16.5" cy="15.5" r="1.2"/>',
      automacao: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9v6M12 9v6M16 9v6"/><circle cx="8" cy="11" r="1.2" fill="currentColor"/><circle cx="16" cy="13" r="1.2" fill="currentColor"/>',
      seguranca: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9.5 12l1.8 1.8 3.2-3.6"/>',
      lazer: '<path d="M12 3l1.8 4.6L18.5 9l-3.7 3 1.2 4.8L12 14.4 8 16.8 9.2 12 5.5 9l4.7-1.4z"/>',
      fitness: '<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',
      festa: '<path d="M5 20l4-12 7 7z"/><path d="M14 4l1 1M18 6l-1 1M19 10h-1M16 2l.5 1.5"/>',
      localizacao: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
      padrao: '<path d="M5 9l3-4h8l3 4-7 11z"/><path d="M5 9h14M10 5l-1 4 3 11 3-11-1-4"/>',
      estrutura: '<path d="M4 21V7l7-4 7 4v14"/><path d="M9 21v-5h6v5M9 9h2M13 9h2M9 12h2M13 12h2"/>',
      elevador: '<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M12 3v18M9.5 8l-1.5 2h3zM14.5 8l1.5 2h-3z" fill="currentColor"/>',
      acessivel: '<circle cx="12" cy="5" r="1.6"/><path d="M9 9h6M12 9v5l3 5M9 11l-1 4"/>',
      design: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 1 4 10.5c-.6.6-1 1.3-1 2.1H9c0-.8-.4-1.5-1-2.1A6 6 0 0 1 12 3z"/>',
      praticidade: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      conforto: '<path d="M4 13v5M20 13v5M5 13h14a2 2 0 0 1 2 2v1H3v-1a2 2 0 0 1 2-2z"/><path d="M6 13v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>',
      check: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    };
    let p;
    if (/energia|solar|renov/.test(s)) p = I.energia;
    else if (/el[eé]tric/.test(s)) p = I.eletrico;
    else if (/garagem|box|vaga|carro/.test(s)) p = I.carro;
    else if (/comodidade|persiana|automa|controle|smart/.test(s)) p = I.automacao;
    else if (/seguran|fechadura|biometr/.test(s)) p = I.seguranca;
    else if (/fitness|academia|bicicl/.test(s)) p = I.fitness;
    else if (/festa|sal[ãa]o|pub|kids|rooftop|lounge|sunset/.test(s)) p = I.festa;
    else if (/lazer|conviv|bem-estar|piscina/.test(s)) p = I.lazer;
    else if (/localiza/.test(s)) p = I.localizacao;
    else if (/elevador|maca/.test(s)) p = I.elevador;
    else if (/acess[íi]vel|wc|banheir/.test(s)) p = I.acessivel;
    else if (/design|led|ilumin/.test(s)) p = I.design;
    else if (/estrutura|hall|edif[íi]cio|fachada/.test(s)) p = I.estrutura;
    else if (/padr[ãa]o|acabamento|qualidade|refin/.test(s)) p = I.padrao;
    else if (/conforto/.test(s)) p = I.conforto;
    else if (/pratic|coletiv|lavanderia/.test(s)) p = I.praticidade;
    else p = I.check;
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  }
})();
