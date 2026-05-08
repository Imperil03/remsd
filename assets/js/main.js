const navToggle = document.querySelector("[data-nav-toggle]");
const siteNav = document.querySelector("[data-site-nav]");
const requestForm = document.querySelector("[data-request-form]");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("is-nav-open", isOpen);
  });

  siteNav.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLAnchorElement)) return;
    siteNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-nav-open");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    siteNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-nav-open");
  });
}

if (requestForm) {
  requestForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const status = requestForm.querySelector("[data-form-status]");
    if (status) {
      status.textContent = "Заявка заполнена. Подключим отправку формы на следующем этапе.";
    }
  });
}

