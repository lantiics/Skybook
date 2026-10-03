class PostAlterationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PostAlterationError";
    createPopup(message);
  }
}

const additionalPostAlterationHeaders = (identifier) => {
  const postToken = localStorage.getItem(`TOKEN-${identifier}`);

  const additionalHeaders = {};
  if (postToken) {
    additionalHeaders["authorization"] = "Bearer " + postToken;
  }
  return additionalHeaders;
};
const instanceName = () => {
  return document
    .querySelector("meta[name='instance-name']")
    .getAttribute("content");
};

const actOnPost = async (post, actionButton) => {
  const identifier = post.getAttribute("data-identifier");
  const action = actionButton.getAttribute("data-action");
  const additionalHeaders = additionalPostAlterationHeaders(identifier);
  actionButton.disabled = true;
  try {
    switch (action) {
      case "delete":
        const deletion = await fetch(
          `/api/${instanceName()}/entry/${identifier}`,
          { method: "DELETE", headers: { ...additionalHeaders } },
        );
        if (!deletion.ok) {
          throw new Error(deletion.status);
        } else {
          post.remove();
        }
        break;
      case "flag": {
        const flag = await fetch(
          `/api/${instanceName()}/entry/${identifier}/flag`,
          {
            method: "POST",
          },
        );
        if (!flag.ok) throw new Error(flag.status);
        else {
          actionButton.disabled = true;
        }
        break;
      }
      case "toggle-flagging": {
        const flagging = await fetch(
          `/api/${instanceName()}/entry/${identifier}/flagging`,
          { method: "PATCH" },
        );
        if (!flagging.ok) throw new Error(flag.status);
        else {
          switch (actionButton.innerText) {
          }
        }
        break;
      }
      case "pin": {
        const pin = await fetch(
          `/api/${instanceName()}/entry/${identifier}/pin`,
          { method: "PATCH" },
        );
        if (!pin.ok) throw new Error(pin.status);
        else {
          actionButton.removeAttribute("disabled");
          switch (actionButton.innerText) {
            case "pin":
              actionButton.innerText = "unpin";
              break;
            case "unpin":
              actionButton.innerText = "pin";
              break;
          }
        }
        break;
      }
      case "highlight": {
        const highlight = await fetch(
          `/api/${instanceName()}/entry/${identifier}/highlight`,
          { method: "PATCH" },
        );
        if (!highlight.ok) throw new Error(highlight.status);
        else {
          actionButton.removeAttribute("disabled");
          switch (actionButton.innerText) {
            case "highlight":
              actionButton.innerText = "un-highlight";
              break;
            case "un-highlight":
              actionButton.innerText = "highlight";
              break;
          }
        }
        break;
      }
      case "clear-flags": {
        const clearFlags = await fetch(
          `/api/${instanceName()}/entry/${identifier}/clear-flags`,
          { method: "PATCH" },
        );
        if (!clearFlags.ok) throw new Error(clearFlags.status);
        else {
          actionButton.removeAttribute("disabled");
        }
        break;
      }
      case "flagging": {
        const flagging = await fetch(
          `/api/${instanceName()}/entry/${identifier}/flagging`,
          { method: "PATCH" },
        );
        if (!flagging.ok) throw new Error(flagging.status);
        else {
          actionButton.removeAttribute("disabled");
        }
        switch (actionButton.innerText) {
          case "disable flagging":
            actionButton.innerText = "enable flagging";
            break;
          case "enable flagging":
            actionButton.innerText = "disable flagging";
            break;
        }
        break;
      }
      case "approve":
        const approve = await fetch(
          `/api/${instanceName()}/entry/${identifier}/approve`,
          { method: "PATCH" },
        );
        if (!approve.ok) throw new Error(approve.status);
        else post.remove();
        break;
      case "visibility":
        const visibility = await fetch(
          `/api/${instanceName()}/entry/${identifier}/visibility`,
          {
            method: "PATCH",
          },
        );
        if (!visibility.ok) {
          throw new Error(visibility.status);
        } else {
          switch ((await visibility.json()).is_visible) {
            case true:
              actionButton.innerText = "hide";
              break;
            case false:
              actionButton.textContent = "unhide";
              break;
          }
          break;
        }
      case "block":
        const blockReason = window.prompt("Reason?");
        console.log(blockReason);

        const block = await fetch(
          `/api/${instanceName()}/entry/${identifier}/block`,
          {
            method: "PATCH",
            headers: { "Content-Type": "text/plain" },
            body: blockReason,
          },
        );
        if (!block.ok) {
          throw new Error(block.status);
        } else {
          break;
        }

      case "unblock":
        const unblock = await fetch(
          `/api/${instanceName()}/entry/${identifier}/block`,
          {
            method: "DELETE",
          },
        );
        if (!unblock.ok) {
          throw new Error(unblock.status);
        } else {
          break;
        }

      case "lock":
        const lock = await fetch(
          `/api/${instanceName()}/entry/${identifier}/lock`,
          { method: "PATCH" },
        );
        if (!lock.ok) {
          throw new Error(lock.status);
        } else {
          switch ((await lock.json()).is_locked) {
            case true:
              actionButton.innerText = "unlock";
              break;
            case false:
              actionButton.innerText = "lock";
          }
          break;
        }
    }
    location.reload();
  } catch (e) {
    const errorMessage = errorStatus(e.message) ?? e.message;
    throw new PostAlterationError("Failed to act on post: " + errorMessage);
  } finally {
    if (action !== "flag") {
      setTimeout(() => actionButton.removeAttribute("disabled"), 1000);
    }
  }
};

const temporarilyDisableButton = (button) => {
  button.disabled = true;
  setTimeout(button.removeAttribute("disabled"), 3000);
};

const postIdentifier = (post) => {
  return post.getAttribute("data-identifier");
};
const postActionBtn = (post, action) => {
  return post
    .querySelector(".actions")
    .querySelector(`[data-action=${action}]`);
};
const addPostActionButtons = (post) => {
  const existingRow = post.querySelector("div.actions");
  const actionRow =
    existingRow ??
    Object.assign(document.createElement("div"), {
      className: "actions",
    });
  const deleteButton = Object.assign(document.createElement("button"), {
    className: "danger",
    onclick: () => actOnPost(post, deleteButton),
    innerText: "delete",
  }); //  <button onclick="approvePost(this.parentNode.parentNode)" data-action="approve">approve</button>
  deleteButton.setAttribute("data-action", "delete");
  if (!actionRow.querySelector('[data-action="delete"]')) {
    actionRow.insertBefore(deleteButton, actionRow.firstChild);
  }
  if (!existingRow) {
    post.append(actionRow);
  }
};

const editPost = async (post, field) => {
  const fieldName = field.getAttribute("data-field");
  const identifier = postIdentifier(post);
  const postToken = localStorage.getItem(`TOKEN-${identifier}`);

  const additionalHeaders = {};
  if (postToken) {
    additionalHeaders["authorization"] = "Bearer " + postToken;
  }
  const res = await fetch(`/api/${instanceName()}/entry/${identifier}`, {
    method: "PATCH",
    headers: {
      ...additionalHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      [fieldName]: field.innerText,
    }),
  });
  if (!res.ok) {
    field.innerText = field.getAttribute("data-original-content");
    let msg;
    if (res.status === 423) msg = "Insufficient privileges";
    else msg = "Post returned " + res.status;
    throw new PostAlterationError("Failed to edit post: " + msg);
  } else {
    // const newContent = (await res.json())[fieldName];
    // field.innerText = field.innerText;
    field.setAttribute("data-original-content", field.innerText);
  }
};

const checkForAlterableEntries = () => {
  const entries = document.querySelectorAll("[data-can-alter]");
  console.log(entries);

  for (const entry of entries) {
    if (localStorage.getItem(postIdentifier(entry))) {
      entry.querySelector("div.actions > button[data-action='flag']")?.remove();
      entry.setAttribute("data-can-alter", true);
      const userDefinedEntryFields = entry.querySelectorAll(
        "div > [contenteditable]",
      );
      for (const field of userDefinedEntryFields) {
        field.setAttribute("contenteditable", true);
      }
      addPostActionButtons(entry);
    }
  }
};

const addEditListeners = () => {
  const fields = document
    .getElementById("entries")
    .querySelectorAll("[contentEditable]");
  console.log(fields);
  for (const field of fields) {
    field.setAttribute("data-original-content", field.innerText);
    field.addEventListener("keypress", async (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (field.innerText != field.getAttribute("data-original-content")) {
          if (!field.getAttribute("data-reply-to")) {
            await editPost(field.parentNode.parentNode, field);
          } else {
            await reply(
              field.parentNode.parentNode.parentNode,
              field.innerText,
            );
          }
        }
      }
    });
  }
};

const refreshEntries = async () => {};

const submitEntry = async (identifier, fields) => {
  const res = await fetch(`/api/${instanceName()}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    createPopup("Failed to submit entry");
    appendWidget();
  } else {
    const identifier = (await res.json()).identifier;
    const token = res.headers.get("token");
    localStorage.setItem(`TOKEN-${identifier}`, token);
    console.log(res.status);
    if (res.status === 201) {
      location.reload();
    } else if (res.status === 202) {
      createPopup(
        "Your entry was submitted and will be visible after being approved.",
        3000,
      );
    }
  }
};
const reply = async (post, message = null) => {
  const identifier = post.getAttribute("data-identifier");
  const prompt = message ?? window.prompt("message");
  if (prompt) {
    const message = prompt;
    // console.log(author, message);
    const res = await fetch(
      `/api/${instanceName()}/entry/${identifier}/reply`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      },
    );
    if (!res.ok) createPopup(res.status.toString(), 3000);
    else location.reload();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("submission-form")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      console.log(this);
      const formData = new URLSearchParams(new FormData(this));
      this.querySelector("fieldset").disabled = true;
      fetch(this.action, {
        method: "POST",
        body: formData,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(res.status);
          const identifier = (await res.json()).identifier;
          const token = res.headers.get("token");
          localStorage.setItem(`TOKEN-${identifier}`, token);
          if (res.status === 201) {
            location.reload();
          } else if (res.status === 202)
            createPopup(
              "Your entry was filtered and will require manual approval before becoming visible",
              3000,
            );
        })
        .catch((e) => {
          appendWidget();
          createPopup(
            "Unable to submit entry: " + errorStatus(e.message.toString()),
            3000,
          );
        });
      setTimeout(
        () => this.querySelector("fieldset").removeAttribute("disabled"),
        3000,
      );
    });
  checkForAlterableEntries();
  addEditListeners();
});
