
    /* Empty the cart now that the order is placed. */
    try { localStorage.removeItem("wr_cart"); } catch (e) {}

    (function () {
      function money(cents, cur) {
        try { return new Intl.NumberFormat("en-US", { style: "currency", currency: (cur || "usd").toUpperCase() }).format((cents || 0) / 100); }
        catch (e) { return "$" + ((cents || 0) / 100).toFixed(2); }
      }
      var id = new URLSearchParams(location.search).get("session_id");
      if (!id) return;
      fetch("/api/order-summary?session_id=" + encodeURIComponent(id))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d) return;
          if (d.order_number) {
            var el = document.getElementById("orderNo");
            el.textContent = "Order " + d.order_number;
            el.hidden = false;
          }
          var rows = (d.items || []).map(function (it) {
            return '<tr><td class="qty">' + it.qty + ' &times;</td><td>' + escapeHtml(it.name) + '</td><td class="amt">' + money(it.amount, d.currency) + '</td></tr>';
          }).join("");
          var sums = '<tr class="sum"><td colspan="2">Subtotal</td><td class="amt">' + money(d.subtotal, d.currency) + '</td></tr>';
          if (d.discount > 0) sums += '<tr class="sum disc"><td colspan="2">Discount</td><td class="amt">&minus;' + money(d.discount, d.currency) + '</td></tr>';
          sums += '<tr class="sum"><td colspan="2">Shipping</td><td class="amt">' + (d.shipping > 0 ? money(d.shipping, d.currency) : "Free") + '</td></tr>';
          sums += '<tr class="sum total"><td colspan="2">Total</td><td class="amt">' + money(d.total, d.currency) + '</td></tr>';
          var box = document.getElementById("summary");
          box.innerHTML = '<table>' + rows + '</table><div class="summary-sep"></div><table>' + sums + '</table>';
          box.hidden = false;
          /* Meta Pixel: the purchase, once. The Stripe session id is the
             event id, so a refresh of this page cannot count it twice. */
          try {
            var fired = sessionStorage.getItem("wr-fb-purchase") === id;
            if (window.fbq && !fired) {
              var n = (d.items || []).reduce(function (a, it) { return a + (Number(it.qty) || 0); }, 0);
              fbq("track", "Purchase", { value: (d.total || 0) / 100, currency: String(d.currency || "usd").toUpperCase(), content_type: "product", num_items: n,
                contents: (d.items || []).map(function (it) { return { id: it.name, quantity: it.qty }; }) }, { eventID: id });
              sessionStorage.setItem("wr-fb-purchase", id);
            }
          } catch (e) {}
        })
        .catch(function () {});
      function escapeHtml(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    })();
  