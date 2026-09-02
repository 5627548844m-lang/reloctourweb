/* RELÓCTOUR — чат на сайте. Подключается одной строкой:
   <script src="/widget.js" defer></script>
   Версия 3: переживает перерисовку страницы, ссылки кликабельны. */

(function () {
  "use strict";

  var API = "/.netlify/functions/chat";

  var GREETING =
    "Здравствуйте. Помогу разобраться, подходит ли вам страна — честно, без уговоров.\n\n" +
    "Сейчас работаем по Испании, Таиланду, Панаме и Франции. С чего начнём?";

  // Текст кнопок лендинга, которые тоже должны открывать чат. Пусто = только своя кнопка.
  var CATCH = [];

  // Состояние живёт снаружи — переживает пересоздание элементов
  var history = [];
  var busy = false;
  var greeted = false;
  var wasOpen = false;

  var CSS = [
    ".rt-launch{position:fixed;right:22px;bottom:96px;z-index:2147483646;padding:14px 24px;",
    "border:1px solid #C9A227;background:rgba(8,36,33,.94);color:#F3EAD8;",
    "font:500 14px/1 Georgia,'Times New Roman',serif;letter-spacing:.06em;",
    "border-radius:2px;cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,.4);",
    "transition:background .2s,border-color .2s;-webkit-tap-highlight-color:transparent}",
    ".rt-launch:hover{background:#0E3B32;border-color:#E3C766}",
    ".rt-launch:focus-visible{outline:2px solid #E3C766;outline-offset:3px}",
    ".rt-launch[hidden]{display:none}",

    ".rt-panel{position:fixed;right:22px;bottom:22px;z-index:2147483647;width:390px;",
    "max-width:calc(100vw - 32px);height:580px;max-height:calc(100vh - 44px);",
    "display:none;flex-direction:column;background:#082421;color:#F3EAD8;",
    "border:1px solid #C9A227;border-radius:2px;box-shadow:0 24px 70px rgba(0,0,0,.55);",
    "font-family:Georgia,'Times New Roman',serif}",
    ".rt-panel.rt-open{display:flex}",

    ".rt-head{display:flex;align-items:center;justify-content:space-between;",
    "padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.35)}",
    ".rt-brand{font-size:12px;letter-spacing:.22em;color:#E3C766}",
    ".rt-x{background:none;border:none;color:#F3EAD8;font-size:24px;line-height:1;",
    "cursor:pointer;padding:2px 6px;opacity:.75}",
    ".rt-x:hover{opacity:1}",

    ".rt-log{flex:1;overflow-y:auto;padding:18px 20px;display:flex;",
    "flex-direction:column;gap:14px}",
    ".rt-b{max-width:88%;padding:11px 15px;font-size:15px;line-height:1.55;",
    "white-space:pre-wrap;word-wrap:break-word;border-radius:2px}",
    ".rt-b.bot{background:rgba(243,234,216,.07);border-left:2px solid #C9A227;align-self:flex-start}",
    ".rt-b.me{background:#C9A227;color:#17130A;align-self:flex-end}",
    ".rt-b.err{background:rgba(170,60,50,.18);border-left:2px solid #AA3C32;align-self:flex-start}",
    ".rt-b a{color:#E3C766;text-decoration:underline;word-break:break-all}",
    ".rt-b.me a{color:#17130A}",
    ".rt-dots span{opacity:.35;animation:rtd 1.2s infinite}",
    ".rt-dots span:nth-child(2){animation-delay:.2s}",
    ".rt-dots span:nth-child(3){animation-delay:.4s}",
    "@keyframes rtd{0%,60%,100%{opacity:.25}30%{opacity:1}}",

    ".rt-foot{border-top:1px solid rgba(201,162,39,.35);padding:12px;display:flex;gap:8px}",
    ".rt-in{flex:1;resize:none;min-height:46px;max-height:120px;",
    "background:rgba(243,234,216,.06);border:1px solid rgba(201,162,39,.4);color:#F3EAD8;",
    "padding:13px;font:inherit;font-size:15px;border-radius:2px}",
    ".rt-in::placeholder{color:rgba(243,234,216,.45)}",
    ".rt-in:focus{outline:none;border-color:#C9A227}",
    ".rt-go{background:#C9A227;border:none;color:#17130A;padding:0 20px;",
    "font:600 17px/1 inherit;cursor:pointer;border-radius:2px}",
    ".rt-go:disabled{opacity:.4;cursor:default}",

    "@media (max-width:520px){.rt-panel{right:0;bottom:0;width:100vw;height:100dvh;",
    "max-height:none;border:none}.rt-launch{right:16px;bottom:84px;padding:13px 20px}}"
  ].join("");

  function ensureStyle() {
    if (document.getElementById("rt-style")) return;
    var style = document.createElement("style");
    style.id = "rt-style";
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureWidget() {
    ensureStyle();
    if (!document.body) return;
    if (document.getElementById("rt-panel")) return;

    var launch = document.createElement("button");
    launch.type = "button";
    launch.id = "rt-launch";
    launch.className = "rt-launch";
    launch.textContent = "Задать вопрос";

    var panel = document.createElement("div");
    panel.id = "rt-panel";
    panel.className = "rt-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Чат с RELÓCTOUR");
    panel.innerHTML =
      '<div class="rt-head"><span class="rt-brand">RELÓCTOUR</span>' +
      '<button type="button" class="rt-x" aria-label="Закрыть">&times;</button></div>' +
      '<div class="rt-log" aria-live="polite"></div>' +
      '<div class="rt-foot">' +
      '<textarea class="rt-in" rows="1" maxlength="2000" ' +
      'placeholder="Спросите про страну, цены или сроки"></textarea>' +
      '<button type="button" class="rt-go" aria-label="Отправить">&rarr;</button></div>';

    document.body.appendChild(launch);
    document.body.appendChild(panel);

    var log = panel.querySelector(".rt-log");
    var input = panel.querySelector(".rt-in");
    var go = panel.querySelector(".rt-go");
    var x = panel.querySelector(".rt-x");

    function bubble(text, cls) {
      var el = document.createElement("div");
      el.className = "rt-b " + cls;
      linkify(el, text);
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }

    // Превращает ссылки в тексте в кликабельные, не используя innerHTML
    function linkify(el, text) {
      var re = /(https?:\/\/[^\s<>()]+)/g;
      var last = 0;
      var m;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) {
          el.appendChild(document.createTextNode(text.slice(last, m.index)));
        }
        var url = m[1].replace(/[.,;:!?]+$/, "");
        var a = document.createElement("a");
        a.href = url;
        a.textContent = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        el.appendChild(a);
        last = m.index + url.length;
      }
      if (last < text.length) {
        el.appendChild(document.createTextNode(text.slice(last)));
      }
    }

    // Восстановить переписку, если элементы пересоздались
    for (var i = 0; i < history.length; i++) {
      if (i === 0 && greeted) bubble(GREETING, "bot");
      bubble(history[i].content, history[i].role === "user" ? "me" : "bot");
    }
    if (greeted && history.length === 0) bubble(GREETING, "bot");

    function open() {
      panel.classList.add("rt-open");
      launch.hidden = true;
      wasOpen = true;
      if (!greeted) {
        bubble(GREETING, "bot");
        greeted = true;
      }
      setTimeout(function () { input.focus(); }, 50);
    }

    function close() {
      panel.classList.remove("rt-open");
      launch.hidden = false;
      wasOpen = false;
    }

    if (wasOpen) {
      panel.classList.add("rt-open");
      launch.hidden = true;
    }

    launch.addEventListener("click", open);
    x.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("rt-open")) close();
    });

    Array.prototype.forEach.call(
      document.querySelectorAll("[data-rt-open]"),
      function (el) {
        el.addEventListener("click", function (e) { e.preventDefault(); open(); });
      }
    );

    if (CATCH.length) {
      Array.prototype.forEach.call(
        document.querySelectorAll("a,button"),
        function (el) {
          var t = (el.textContent || "").trim().toLowerCase();
          if (CATCH.indexOf(t) !== -1) {
            el.addEventListener("click", function (e) { e.preventDefault(); open(); });
          }
        }
      );
    }

    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 120) + "px";
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    });
    go.addEventListener("click", submit);

    function submit() {
      var text = input.value.trim();
      if (!text || busy) return;

      bubble(text, "me");
      history.push({ role: "user", content: text });
      input.value = "";
      input.style.height = "auto";

      busy = true;
      go.disabled = true;

      var typing = bubble("", "bot");
      typing.innerHTML = '<span class="rt-dots"><span>•</span><span>•</span><span>•</span></span>';

      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history })
      })
        .then(function (r) {
          return r.json().then(function (d) { return { ok: r.ok, data: d }; });
        })
        .then(function (res) {
          typing.remove();
          if (!res.ok || !res.data.reply) {
            bubble(
              (res.data && res.data.error) ||
                "Не получилось ответить. Напишите в Telegram: @Reloctour_bot",
              "err"
            );
            history.pop();
            return;
          }
          bubble(res.data.reply, "bot");
          history.push({ role: "assistant", content: res.data.reply });
        })
        .catch(function () {
          typing.remove();
          bubble("Нет связи с сервером. Напишите в Telegram: @Reloctour_bot", "err");
          history.pop();
        })
        .then(function () {
          busy = false;
          go.disabled = false;
          input.focus();
        });
    }
  }

  // Ставим сразу, потом следим — если страницу перерисовали, возвращаем виджет
  ensureWidget();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureWidget);
  }
  window.addEventListener("load", ensureWidget);
  setInterval(ensureWidget, 1000);
})();
