document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("authentication")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      const formData = new URLSearchParams(new FormData(this));
      fetch(this.action, {
        method: "POST",
        body: formData,
      }).then(async (res) => {
        if (res.ok) {
          location.assign(res.headers.get("goto"));
        } else {
          switch (res.status) {
            case 423:
              createPopup("Your account has been locked", 10000);
              break;
            case 409:
              createPopup(
                `An account with the username '${this.username.value}' already exists`,
                5000,
              );
              break;
            default:
              createPopup(errorStatus(res.status.toString()), 3500);
          }
          document.querySelectorAll("#captcha").forEach((e) => e.remove());
          appendWidget();
        }
      });
    });
});
