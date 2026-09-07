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
            default:
              createPopup(errorStatus(res.status.toString()), 3500);
          }
          appendWidget();
        }
      });
    });
});

//   document
//     .getElementById("submission-form")
//     .addEventListener("submit", function (e) {
//       e.preventDefault();
//       console.log(this);
//       const formData = new URLSearchParams(new FormData(this));

//       fetch(this.action, {
//         method: "POST",
//         body: formData,
//       }).then(async (res) => {
//         const identifier = (await res.json()).identifier;
//         const token = res.headers.get("token");
//         localStorage.setItem(identifier, token);
//       });
//     });
