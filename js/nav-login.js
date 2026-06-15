// Login Page Navigation Loader
function loadLoginNavigation() {
  fetch("nav-login.html")
    .then((response) => response.text())
    .then((data) => {
      // Find the logo section and replace it with the navigation
      const existingLogoSection = document.querySelector(".logo-section");
      if (existingLogoSection) {
        existingLogoSection.outerHTML = data;
      } else {
        // If no existing logo section, insert at the beginning of login card
        const loginCard = document.querySelector(".login-card");
        if (loginCard) {
          loginCard.insertAdjacentHTML("afterbegin", data);
        }
      }
    })
    .catch((error) => {
      console.error("Error loading login navigation:", error);
    });
}

// Load navigation when DOM is ready
document.addEventListener("DOMContentLoaded", loadLoginNavigation);
