const popups = [];

const createPopup = (text, duration = 1500) => {
  const popupElem = Object.assign(document.createElement("div"), {
    className: "btm-popup",
    innerText: text,
  });

  document.body.append(popupElem);
  popups.unshift(popupElem);
  popupElem.classList.add("visible");
  requestAnimationFrame(() => {
    repositionPopups();
  });
  setTimeout(() => removePopup(popupElem), duration);
};
const removePopup = (popupElem) => {
  //   console.log(popup);
  const index = popups.indexOf(popupElem);
  if (index !== -1) popups.splice(index, 1);
  popupElem.style.opacity = 0;
  //   popupElem.classList.remove("visible");
  setTimeout(() => {
    popupElem.remove();
    repositionPopups();
  }, 350);
};
const repositionPopups = () => {
  console.log(popups.length);
  const gap = 10;
  let offset = 0;
  for (const popup of popups) {
    popup.style.bottom = `calc(3rem + ${offset}px)`;
    offset += popup.offsetHeight + gap;
  }
};
let i = 0;
// document.addEventListener("DOMContentLoaded", () => {
//   setInterval(() => {
//     createPopup(i);
//     i++;
//   }, 500);
// });
