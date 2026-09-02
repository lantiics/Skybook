class PostAlterationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PostAlterationError";
    createPopup(message);
  }
}
const additionalPostAlterationHeaders = (identifier) => {
  const postToken = localStorage.getItem(identifier);

  const additionalHeaders = {};
  if (postToken) {
    additionalHeaders["authorization"] = "Bearer " + postToken;
  }
  return additionalHeaders;
};
const instanceName = () => {
  return document.querySelector("meta[name='instance-name']").content;
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
      case "approve":
        break;
      case "visibility":
        const visibility = await fetch(
          `/api/${instanceName()}/entry/${identifier}/visibility`,
          {
            method: "PATCH",
            headers: { ...additionalHeaders },
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
          return;
        }
      case "block":
        const block = await fetch(
          `/api/${instanceName()}/entry/${identifier}/block`,
          {
            method: "PATCH",
          },
        );
        if (!block.ok) {
          throw new Error(block.status);
        } else {
          return;
        }
      case "unblock":
        const unblock = await fetch(
          `/api/${instanceName()}/entry/${identifier}/unblock`,
          {
            method: "PATCH",
          },
        );
        if (!unblock.ok) {
          throw new Error(unblock.status);
        } else {
          return;
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
          return;
        }
    }
  } catch (e) {
    let errorMessage;
    switch (e.message) {
      case "423":
        errorMessage = "Insufficient privileges";
        break;
      default:
        errorMessage = e.message;
    }
    throw new PostAlterationError("Failed to act on post: " + errorMessage);
  } finally {
    setTimeout(() => actionButton.removeAttribute("disabled"), 1000);
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
  const actionRow = Object.assign(document.createElement("div"), {
    className: "actions",
  });
  const deleteButton = Object.assign(document.createElement("button"), {
    className: "danger",
    onclick: () => actOnPost(post, deleteButton),
    innerText: "delete",
  }); //  <button onclick="approvePost(this.parentNode.parentNode)" data-action="approve">approve</button>
  deleteButton.setAttribute("data-action", "delete");
  actionRow.append(deleteButton);
  post.appendChild(actionRow);
};

const editPost = async (post, field) => {
  const fieldName = field.getAttribute("data-field");
  const identifier = postIdentifier(post);
  const postToken = localStorage.getItem(identifier);

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
    const newContent = (await res.json())[0][fieldName];
    field.innerText = newContent;
    field.setAttribute("data-original-content", newContent);
  }
};

const checkForAlterableEntries = () => {
  const entries = document.querySelectorAll("[data-can-alter='false']");
  console.log(entries);

  for (const entry of entries) {
    if (localStorage.getItem(postIdentifier(entry))) {
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
          await editPost(field.parentNode.parentNode, field);
        }
      }
    });
  }
};

const refreshEntries = async () => {};

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
          localStorage.setItem(identifier, token);
        })
        .catch((e) => {
          createPopup("Unable to submit entry: " + e.message, 3000);
        });
      setTimeout(
        () => this.querySelector("fieldset").removeAttribute("disabled"),
        3000,
      );
    });
  checkForAlterableEntries();
  addEditListeners();
});
