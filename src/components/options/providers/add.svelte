<script>
import _ from "lodash";
import Notiflix from "notiflix";
import { createEventDispatcher } from "svelte";

import { isJson, isUrl, isSearchable } from "../../../js/shared/misc";
import LocalStore from "../../../js/shared/local_store";
import { MiscURLs, StoreKey } from "../../../js/shared/constants";

const dispatch = createEventDispatcher();

// Constants.
const DEFAULT = {
  label: "",
  link: "",
  postEnabled: false,
  postValue: null,
  proxyEnabled: false,
  proxyUrl: null,
};

// States.
let editData = _.clone(DEFAULT);
let errors = {};
let warning;

// Methods.
async function add() {
  if (validate()) {
    // Add new provider
    const searchProviders = await LocalStore.getOne(StoreKey.SEARCH_PROVIDERS);
    searchProviders.push({
      menuIndex: -1,
      enabled: true,
      fromConfig: false,
      group: 0,
      ...editData,
    });
    await LocalStore.setOne(StoreKey.SEARCH_PROVIDERS, searchProviders);

    // Clear form
    clear();

    Notiflix.Notify.Success("Option added successfully");
    dispatch("updateMainConfiguration");
  }
}

function validate() {
  validateLabel();
  validateLink();
  validatePost();
  validateProxy();

  if (!_.isEmpty(errors)) {
    Notiflix.Notify.Failure("Some fields are empty or have invalid values");
    return false;
  }

  return true;
}

function updateError(field, isInvalid) {
  if (isInvalid) {
    errors[field] = true;
  } else {
    delete errors[field];
  }
  errors = errors;
}

function validateLabel() {
  updateError("label", _.isEmpty(editData.label));
}

// "isActive" is 'true', when user is typing on the input field.
// It is used not to add any warning or error when user is typing.
function validateLink(isActive) {
  if (!isActive || errors.link) {
    updateError("link", !isUrl(editData.link));
  }

  if (errors["link"] || isSearchable(editData.link)) {
    warning = null;
  } else if (!isActive) {
    warning = "The link contains neither TESTSEARCH nor TESTB64SEARCH";
  }
}

function validatePost() {
  updateError(
    "postValue",
    editData.postEnabled &&
      (_.isEmpty(editData.postValue) || !isJson(editData.postValue))
  );
}

function validateProxy() {
  updateError("proxyUrl", editData.proxyEnabled && !isUrl(editData.proxyUrl));
}

function clear() {
  editData = _.clone(DEFAULT);
  errors = {};
  warning = null;
}
</script>

<div>
  <p>
    WARNING: Due to this being converted from a Chromium-based instance to a Firefox instance by a complete noob, you must take a few steps to use it properly.  Ensure you enable groups on the "Settings" tab.  Then, enable the desired group(s) at the bottom of the "Search Providers" page.  Finally, ensure the desired group is enabled under the Context Menu Item of your choice.  YOU MUST USE GROUPS AS INDIVIDUAL TAB OPENING DOES NOT WORK IN FIREFOX!  YOU HAVE BEEN WARNED!!!
  </p>
  <p>
    To add a new search option, enter the search term as "TESTSEARCH" and copy
    the complete (including http://) URL of the results page to the 'Link' field
    below. You can also use "%s" to denote search terms, or "TESTB64SEARCH" if
    you need the term Base64 encoded first. This could be useful when you are
    copy-pasting from {process.env.BROWSER_NAME} settings or trying to use CyberChef.
  </p>
  <p>
    Most users will not need to use the POST function. The POST function is
    useful when you want to POST (versus GET) a search term to an application or
    API. You copy the destination URL to the 'Link' field and add the raw POST
    data in the 'Add POST value' field. The HTTP POST will come from the
    {process.env.BROWSER_NAME} extension by default, which some applications/API's
    may not allow. In that case use a PROXY to send the POST.
  </p>
  <p>
    For more information visit
    <a
      id="extension_home_url"
      target="_blank"
      href="{MiscURLs.EXTENSION_HOME_URL}">
      {MiscURLs.EXTENSION_HOME_URL}}
    </a>.
  </p>
</div>

<div class="border rounded py-2 px-3">
  <form name="add_provider">
    <div class="row">
      <div class="col-md-4">
        <div class="form-group mb-0">
          <label class="mb-1" for="providers_name"> Display name </label>
          <input
            type="text"
            class="form-control"
            class:is-invalid="{errors.label}"
            name="label"
            placeholder="Label to be used in the context menu"
            id="providers_name"
            bind:value="{editData.label}"
            on:blur="{validateLabel}"
            on:input="{() => errors.label && validateLabel()}" />
          {#if errors.label}
            <div class="invalid-feedback ml-1">The value must not be empty</div>
          {/if}
        </div>
      </div>
      <div class="col-md-8">
        <div class="form-group mb-0">
          <label class="mb-1" for="providers_link">Link</label>
          <input
            type="text"
            class="form-control"
            class:is-invalid="{errors.link}"
            name="link"
            placeholder="URL address to which send requests"
            id="providers_link"
            bind:value="{editData.link}"
            on:blur="{() => validateLink()}"
            on:input="{() => validateLink(true)}" />
          {#if errors.link}
            <div class="invalid-feedback ml-1">
              {editData.link
                ? "The value must be a valid URL"
                : "The value must not be empty"}
            </div>
          {/if}
          {#if warning}
            <div class="text-warning text-small ml-1 mt-1">{warning}</div>
          {/if}
        </div>
      </div>
    </div>

    <div class="row mt-2">
      <div class="col-md-4">
        <div class="form-check ml-2 mt-2">
          <label class="form-check-label">
            <input
              type="checkbox"
              class="form-check-input"
              name="postEnabled"
              bind:checked="{editData.postEnabled}"
              on:change="{() => errors.postValue && validatePost()}" />
            Add POST value
          </label>
        </div>
      </div>
      <div class="col-md-8">
        <input
          type="text"
          class="form-control text-monospace"
          class:is-invalid="{errors.postValue}"
          name="postValue"
          placeholder="JSON object to send in POST request"
          disabled="{!editData.postEnabled}"
          bind:value="{editData.postValue}"
          on:blur="{validatePost}"
          on:input="{() => errors.postValue && validatePost()}" />
        {#if errors.postValue}
          <div class="invalid-feedback ml-1">
            {editData.postValue
              ? "The value must be a valid JSON object"
              : "The value must not be empty if post is enabled"}
          </div>
        {/if}
      </div>
    </div>

    <div class="row mt-2">
      <div class="col-md-4">
        <div class="form-check ml-2 mt-2">
          <label class="form-check-label">
            <input
              type="checkbox"
              class="form-check-input"
              name="proxyEnabled"
              bind:checked="{editData.proxyEnabled}"
              on:change="{() => errors.proxyUrl && validateProxy()}" />
            Use Proxy
          </label>
        </div>
      </div>
      <div class="col-md-8">
        <input
          type="text"
          class="form-control"
          class:is-invalid="{errors.proxyUrl}"
          name="proxyUrl"
          placeholder="URL address of Proxy server"
          disabled="{!editData.proxyEnabled}"
          bind:value="{editData.proxyUrl}"
          on:blur="{validateProxy}"
          on:input="{() => errors.proxyUrl && validateProxy()}" />
        {#if errors.proxyUrl}
          <div class="invalid-feedback ml-1">
            {editData.proxyUrl
              ? "The value must be a valid URL"
              : "The value must not be empty if proxy is enabled"}
          </div>
        {/if}
      </div>
    </div>

    <div class="text-right mt-2">
      <button
        type="submit"
        class="btn btn-success"
        on:click|preventDefault="{add}">
        <i class="fas fa-plus-circle" aria-hidden="true"></i> Add new option
      </button>
    </div>
  </form>
</div>
