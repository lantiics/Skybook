// helpers

let existingFields = [];

const openTab = (btn, tabName) => {
  const tabPanes = document.getElementsByClassName("tab-pane");
  for (const tab of tabPanes) {
    tab.classList.remove("active");
  }
  const tabLinks = document.getElementsByClassName("tab-link");
  for (const tabLink of tabLinks) {
    tabLink.classList.remove("active");
  }
  document.getElementById(tabName).classList.add("active");
  if (btn) btn.classList.add("active");
  else
    document.querySelector(`[data-tab='${tabName}']`).classList.add("active");
  history.replaceState(null, "", `#${tabName}`);
};
// settings

const toggleStatus = async (btn) => {
  event.preventDefault();
  console.log("arr");
  const action = btn.getAttribute("data-action");
  btn.disabled = true;
  try {
    switch (action) {
      case "visibility":
        const visibility = await fetch(`/api/${instanceName()}/visibility`, {
          method: "PATCH",
        });
        if (!visibility.ok) {
          throw new Error(visibility.status);
        }
        break;
      case "submission":
        const submission = await fetch(`/api/${instanceName()}/submission`, {
          method: "PATCH",
        });
        if (!submission.ok) {
          throw new Error(submission.status);
        }
        break;
      case "approval":
        const approval = await fetch(`/api/${instanceName()}/approval`, {
          method: "PATCH",
        });
        if (!approval.ok) {
          throw new Error(approval.status);
        }
        break;
      case "queue-filtered":
        const queueFiltered = await fetch(
          `/api/${instanceName()}/queue-filtered`,
          { method: "PATCH" },
        );
        if (!queueFiltered.ok) throw new Error(queueFiltered.status);
        break;
      default: {
        throw new Error("Action is not specified");
      }
    }

    btn.checked = !btn.checked;
    console.log(btn.checked);
    btn.removeAttribute("disabled");
  } catch (e) {
    const errorMessage = errorStatus(e.message);
    setTimeout(() => btn.removeAttribute("disabled"), 1500);
    throw new PostAlterationError("Failed: " + errorMessage);
  }
};

const updateFlagThreshold = async (e) => {
  let newThreshold;
  if (e.value === "") newThreshold = 3;
  else newThreshold = e.value;
  e.disabled = true;

  const res = await fetch(`/api/${instanceName()}/queue-threshold`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threshold: newThreshold }),
  });

  if (!res.ok) {
    createPopup(
      "Failed to update threshold: " + errorStatus(res.status.toString()),
    );
    setTimeout(() => e.removeAttribute("disabled"), 2500);
  } else {
    e.removeAttribute("disabled");
  }
};

//#region FILTERS
const submitFieldFilter = async (elem, field) => {
  elem.disabled = true;
  const filter = elem.value;
  const res = await fetch(`/api/${instanceName()}/field/${field}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filter: filter }),
  });
  if (res.ok) elem.removeAttribute("disabled");
  else {
    createPopup(
      "Failed to submit field filter: " + errorStatus(res.status.toString()),
    );
    setTimeout(() => {
      elem.removeAttribute("disabled");
    }, 1500);
  }
  return;
};
const updateGlobalFilter = async (filterTA) => {
  filterTA.disabled = true;
  const res = await fetch(`/api/${instanceName()}/filter`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filter: filterTA.value }),
  });
  if (!res.ok) {
    createPopup(errorStatus(res.status.toString()));
    setTimeout(() => filterTA.removeAttribute("disabled"), 2500);
  } else {
    filterTA.removeAttribute("disabled");
  }
};
//#endregion

// Allow blocking of proxy/VPN/Tor addresses
const blockAddresses = async (btn, service) => {
  event.preventDefault();
  btn.disabled = true;
  try {
    switch (service) {
      case "proxy":
        const proxy = await fetch(`/api/${instanceName()}/proxy`, {
          method: "PATCH",
        });
        if (!proxy.ok) {
          throw new Error(proxy.status);
        } else {
          break;
        }
      case "vpn":
        const vpn = await fetch(`/api/${instanceName()}/vpn`, {
          method: "PATCH",
        });
        if (!vpn.ok) {
          throw new Error(vpn.status);
        } else {
          break;
        }

      case "tor":
        const tor = await fetch(`/api/${instanceName()}/tor`, {
          method: "PATCH",
        });
        if (!tor.ok) {
          throw new Error(tor.status);
        } else {
          break;
        }
    }
    btn.checked = !btn.checked;
    btn.removeAttribute("disabled");
  } catch (e) {
    const errorMessage = errorStatus(e.message) ?? e.message;
    setTimeout(() => btn.removeAttribute("disabled"), 1500);
    createPopup("Failed to block IP range: " + errorMessage);
  }
};

const disableEntryNotifications = async (inp) => {
  withDisabled(inp, async () => {
    const res = await fetch(`/api/${instanceName()}/notifications`, {
      method: "DELETE",
    });
    if (res.ok) {
      createPopup("Successfully disabled new post notifications");
    } else {
      createPopup("Failed to disable notifications for new posts");
    }
  });
};

const enableEntryNotifications = async (inp) => {
  const service = inp.parentNode.querySelector("select").value;
  const URL = inp.value;
  await withDisabled(inp, async () => {
    const res = await fetch(`/api/${instanceName()}/notifications`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: service, url: URL }),
    });
    if (!res.ok)
      createPopup(
        `${res.status !== 503 ? "Failed to enable notifications for new posts" : "Notifications are currently disabled"}`,
      );
  });
  // validate start with http ss
};

//#region FIELDS

const toggleFieldRequired = async (input) => {
  event.preventDefault();
  input.disabled = true;
  const field = input.parentNode.parentNode.getAttribute("data-field-name");
  const res = await fetch(`/api/${instanceName()}/field/${field}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_required: input.checked }),
  });
  if (!res.ok) {
    setTimeout(() => input.removeAttribute("disabled"), 1500);
    createPopup(
      "Failed to toggle field requirement: " +
        errorStatus(res.status.toString()),
    );
  } else {
    input.checked = !input.checked;
    input.removeAttribute("disabled");
    const replacement = input.parentNode.parentNode.querySelector(
      "th > input[data-field-replacement]",
    );
    if (input.checked) replacement.removeAttribute("disabled");
    else replacement.disabled = true;
  }
};

const createNewField = async (btn) => {
  try {
    const fieldTableRow = document.getElementById("newField-row");
    const fieldNameElem = fieldTableRow.querySelector("th#newfield-name");
    const fieldName = fieldNameElem.innerText;
    if (existingFields.includes(fieldName)) {
      throw new Error("Field name already exists");
    }
    const fieldRequiredElem = fieldTableRow.querySelector(
      "th > input#newfield-required",
    );
    const fieldRequired = fieldRequiredElem.checked;
    const fieldReplacementElem = fieldTableRow.querySelector(
      "th > input#newfield-replacement",
    );
    const fieldReplacement = fieldReplacementElem.value;
    const fieldFilterElem = fieldTableRow.querySelector(
      "th > input#newfield-filter",
    );
    const fieldFilter = fieldFilterElem.value;
    console.log(fieldName);
    if (fieldName.length > 50 || fieldName.replace(/ /g, "").length === 0) {
      throw new Error("Field name is not permitted");
    }
    if (fieldFilter.length > 1000) {
      throw new Error("Filter is too long");
    }
    if (fieldReplacement > 50) {
      throw new Error("Replacement is too long");
    }
    const newRecord = {
      name: fieldName,
      is_required: fieldRequired,
      replacement: fieldReplacement,
      filter: fieldFilter,
    };
    const res = await fetch(`/api/${instanceName()}/field/${fieldName}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRecord),
    });
    if (!res.ok) {
      throw new Error(
        "Failed to submit field: Request returned status of " + res.status,
      );
    }
  } catch (e) {
    const errorMessage = errorStatus(e.message) ?? e.message;
    createPopup("Failed to create new field: " + errorMessage);
    throw e;
  }
};

const submitFieldReplacement = async (elem, field) => {
  elem.disabled = true;
  const replacement = elem.value;
  const res = await fetch(`/api/${instanceName()}/field/${field}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ replacement: replacement }),
  });
  if (res.ok) elem.removeAttribute("disabled");
  else {
    createPopup(
      "Failed to submit default field value: " +
        errorStatus(res.status.toString()),
    );
    setTimeout(() => {
      elem.removeAttribute("disabled");
    }, 1500);
  }
  return;
};

const deleteField = async (btn) => {
  btn.disabled = true;
  const fieldName = btn.parentNode.parentNode.getAttribute("data-field-name");
  const res = await fetch(`/api/${instanceName()}/field/${fieldName}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    createPopup(
      "Failed to delete field: " + errorStatus(res.status.toString()),
    );
    setTimeout(() => btn.removeAttribute("disabled"), 2500);
  } else {
    btn.parentNode.parentNode.remove();
    location.reload();
  }
};

const renameField = async (input) => {
  await withDisabled(input, async () => {
    const res = await fetch(
      `/api/${instanceName()}/field/${input.parentNode.getAttribute("data-field-name")}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: input.innerText }),
      },
    );
  });
};

//#endregion
//#region ENTRIES
const deleteReply = async (btn) => {
  btn.disabled = true;
  const identifier =
    btn.parentNode.parentNode.parentNode.parentNode.getAttribute(
      "data-identifier",
    );
  const res = await fetch(`/api/${instanceName()}/entry/${identifier}/reply`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: null }),
  });
  if (!res.ok) {
    createPopup(errorStatus(res.status.toString()));
    setTimeout(() => btn.removeAttribute("disabled"), 1500);
    return;
  }
  btn.removeAttribute("disabled");
  btn.innerText = "reply";
  btn.parentNode.parentNode.remove();
  btn.setAttribute("data-action", "reply");
  btn.onclick = () => reply(btn.parentNode.parentNode);
};
//#endregion
const initializeEventListeners = () => {
  const fieldReplacementElems = document.querySelectorAll(
    "input[data-field-replacement]",
  );
  const fieldFilterElems = document.querySelectorAll(
    "input[data-field-filter]",
  );
  document
    .getElementById("queueFlagThreshold")
    .addEventListener("keyup", function (e) {
      if (e.key === "Enter") {
        updateFlagThreshold(this);
      }
    });
  for (const foo of fieldReplacementElems) {
    const field = foo.getAttribute("data-field-replacement");
    foo.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        submitFieldReplacement(foo, field);
      }
    });
  }
  for (const foo of fieldFilterElems) {
    const field = foo.getAttribute("data-field-filter");
    foo.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        submitFieldFilter(foo, field);
      }
    });
  }
  const globalFilterTextarea = document.getElementById(
    "global-filter-textarea",
  );
  globalFilterTextarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      updateGlobalFilter(globalFilterTextarea);
    }
  });
  for (const field of existingFields) {
    const em = document.querySelector(
      `tr[data-field-name=${JSON.stringify(field)}] > th`,
    );
    console.log(em.getAttribute("contenteditable"), field);
    if (!em.getAttribute("contenteditable")) continue;
    em.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        renameField(em);
      }
    });
  }
  document
    .getElementById("notification-service-url")
    .addEventListener("keydown", async (e) => {
      if (e.key == "Enter") {
        if (e.target.value !== "") {
          enableEntryNotifications(e.target);
        } else {
          disableEntryNotifications(e.target);
        }
      }
    });
};
const removeEventListeners = () => {
  const fieldReplacementElems = document.querySelectorAll(
    "input[data-field-replacement]",
  );
  const fieldFilterElems = document.querySelectorAll(
    "input[data-field-filter]",
  );
  for (const foo of [...fieldReplacementElems, ...fieldFilterElems]) {
    if (foo.style.display === "none") foo.replaceWith(foo.cloneNode(true));
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll("th[data-field='name']")
    .forEach((field) => existingFields.push(field.innerText));
  initializeEventListeners();
  if (/^#Tab/.test(location.hash)) {
    openTab(null, location.hash.replace("#", ""));
  }
});
