(function () {
  "use strict";

  const links = [
    { href: "dashboard.html", label: "Dashboard" },
    { href: "billing.html", label: "Billing" },
    { href: "reportEntry.html", label: "Report Entry" },
    { href: "reports-management.html", label: "Reports" },
  ];
  const managementLinks = [
    { href: "test-management.html", label: "Test Data" },
    { href: "patientHistory.html", label: "Patient History" },
    { href: "reference-management.html", label: "References" },
    { href: "center-management.html", label: "Centers" },
    { href: "package-management.html", label: "Packages" },
    { href: "pricing-management.html", label: "Pricing" },
    { href: "admin-users.html", label: "Admin Users" },
  ];

  function createLink(item, currentPath) {
    const link = document.createElement("a");
    link.href = item.href;
    link.textContent = item.label;
    link.className = "labs-nav__link";
    if (currentPath === item.href.toLowerCase()) {
      link.setAttribute("aria-current", "page");
    }
    return link;
  }

  function renderNavigation() {
    if (document.querySelector(".labs-nav")) return;

    const currentPath = window.location.pathname.split("/").pop().toLowerCase();
    const header = document.createElement("header");
    header.className = "labs-nav";
    header.innerHTML = `
      <div class="labs-nav__inner">
        <a class="labs-nav__brand" href="dashboard.html" aria-label="Suwajeewa Laboratories dashboard">
          <img src="Imgs/suwajeewa_logo.png" alt="">
          <span>
            <strong>SUWAJEEWA</strong>
            <small>Laboratory System</small>
          </span>
        </a>
        <button class="labs-nav__toggle" type="button" aria-expanded="false" aria-controls="labs-nav-links">
          <span class="labs-nav__toggle-icon" aria-hidden="true"></span>
          <span class="labs-nav__toggle-label">Menu</span>
        </button>
        <nav class="labs-nav__links" id="labs-nav-links" aria-label="Main navigation">
          <div class="labs-nav__primary"></div>
          <details class="labs-nav__more">
            <summary>Manage</summary>
            <div class="labs-nav__menu"></div>
          </details>
          <button class="labs-nav__logout" type="button" data-nav-logout>Log out</button>
        </nav>
      </div>
    `;

    const primary = header.querySelector(".labs-nav__primary");
    links.forEach((item) => primary.appendChild(createLink(item, currentPath)));

    const menu = header.querySelector(".labs-nav__menu");
    managementLinks.forEach((item) => menu.appendChild(createLink(item, currentPath)));

    const toggle = header.querySelector(".labs-nav__toggle");
    const navLinks = header.querySelector(".labs-nav__links");
    toggle.addEventListener("click", () => {
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isExpanded));
      navLinks.classList.toggle("is-open", !isExpanded);
    });

    const logoutButton = header.querySelector("[data-nav-logout]");
    if (currentPath === "" || currentPath === "index.html") {
      toggle.hidden = true;
      header.querySelector(".labs-nav__primary").hidden = true;
      header.querySelector(".labs-nav__more").hidden = true;
      const signInLink = document.createElement("a");
      signInLink.href = "#login-form";
      signInLink.textContent = "Sign in";
      signInLink.className = "labs-nav__link";
      logoutButton.replaceWith(signInLink);
    } else {
      logoutButton.addEventListener("click", () => {
        sessionStorage.removeItem("loggedInUser");
        window.location.href = "index.html";
      });
    }

    document.body.insertAdjacentElement("afterbegin", header);
  }

  function loadNavigationStyles() {
    if (document.querySelector('link[href="nav.css"]')) return;
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "nav.css";
    document.head.appendChild(stylesheet);
  }

  loadNavigationStyles();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderNavigation, { once: true });
  } else {
    renderNavigation();
  }
})();
