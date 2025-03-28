
// Load dependencies.
import _ from "lodash";
import { DateTime } from "luxon";

import {
  MiscURLs,
  StoreKey,
  NWI_RANGE_LENGTH,
  RSA_RANGE_LENGTH,
} from "./js/shared/constants";
import { getGroupProviders, getProviderTargetURL } from "./js/shared/misc";
import ConfigFile from "./js/shared/config_file";
import LocalStore from "./js/shared/local_store";

const tabsApi = typeof browser !== "undefined" ? browser.tabs : chrome.tabs;

// Install handler.
chrome.runtime.onInstalled.addListener(installedListener);

export async function installedListener(details) {
  var previous = _.get(details, "previousVersion");

  if (!_.isEmpty(previous) && previous.split(".")[0] === "4") {
    tabsApi.create({
      url: "migration.html?previous=" + previous,
      active: true,
    });
  } else {
    await ConfigFile.sanitizeSettings();

    if (_.get(details, "reason") === "install") {
      tabsApi.create({
        url: MiscURLs.INSTALLED_URL,
        active: true,
      });

      await ConfigFile.updateNow();
    }

    ContextualMenu.update();
  }
}

chrome.runtime.onStartup.addListener(function () {
  ContextualMenu.update();
});

chrome.alarms.create({
  periodInMinutes: 10080,
});
chrome.alarms.onAlarm.addListener(alarmListener);

export async function alarmListener() {
  var settings = await LocalStore.getOne(StoreKey.SETTINGS);
  if (settings.autoUpdateConfig) {
    await ConfigFile.updateNow();
    ContextualMenu.update();
  }
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (_.get(request, "action") === "updateContextualMenu") {
    ContextualMenu.update();
    sendResponse({ success: true });
  }
});

chrome.contextMenus.onClicked.addListener(onClickedListener);

export async function onClickedListener(info, tab) {
  if (info.menuItemId.indexOf(MenuPreffix.GROUP) === 0) {
    await ContextualMenu.groupClicked(info, tab);
  }
  if (info.menuItemId.indexOf(MenuPreffix.PROVIDER) === 0) {
    await ContextualMenu.providerClicked(info, tab);
  }
  if (info.menuItemId.indexOf(MenuPreffix.CARBON_BLACK) === 0) {
    await ContextualMenu.carbonBlackClicked(info, tab);
  }
  if (info.menuItemId.indexOf(MenuPreffix.NET_WITNESS) === 0) {
    await ContextualMenu.netWitnessClicked(info, tab);
  }
  if (info.menuItemId.indexOf(MenuPreffix.RSA_SECURITY) === 0) {
    await ContextualMenu.rsaSecurityClicked(info, tab);
  }
  if (info.menuItemId === MenuPreffix.OPTIONS) {
    await chrome.runtime.openOptionsPage();
  }
}

export var MenuPreffix = {
  CARBON_BLACK: "carbonblack-",
  GROUP: "group-",
  NET_WITNESS: "netwitness-",
  OPTIONS: "optionspage",
  PARENT: "parent-",
  PROVIDER: "searchprovider-",
  RSA_SECURITY: "rsasecurity-",
  SEPARATOR: "separator-",
};

function createContextMenu(item) {
  if (!_.isEmpty(item.title)) {
    return chrome.contextMenus.create(item);
  }
}

export var ContextualMenu = {
  update: async function () {
    chrome.contextMenus.removeAll();

    var searchProviders = (await LocalStore.getOne(StoreKey.SEARCH_PROVIDERS)) || [];
    var settings = (await LocalStore.getOne(StoreKey.SETTINGS)) || {};

    if (settings.useGroups) {
      _.forEach(settings.providersGroups, function (group, index) {
        if (group.enabled && getGroupProviders(index, searchProviders).length > 0) {
          createContextMenu({
            id: MenuPreffix.GROUP + index,
            title: group.name,
            contexts: ["selection"],
          });
        }
      });
    }

    _.forEach(searchProviders, function (provider, index) {
      if (provider.enabled) {
        provider.menuIndex = createContextMenu({
          id: MenuPreffix.PROVIDER + index,
          title: provider.label,
          contexts: ["selection"],
        });
      } else {
        provider.menuIndex = -1;
      }
    });

    await LocalStore.setOne(StoreKey.SEARCH_PROVIDERS, searchProviders);

    if (settings.enableOptionsMenuItem) {
      createContextMenu({
        id: MenuPreffix.OPTIONS,
        title: "Options",
        contexts: ["selection"],
      });
    }
  },

  providerClicked: async function (info, tab) {
    var providers = await LocalStore.getOne(StoreKey.SEARCH_PROVIDERS);
    var provider = _.find(providers, function (item) {
      return item.menuIndex === info.menuItemId;
    });

    if (provider) {
      var targetURL = getProviderTargetURL(provider, info.selectionText);
      var settings = await LocalStore.getOne(StoreKey.SETTINGS);
      var index = settings.enableAdjacentTabs ? tab.index + 1 : null;

      tabsApi.create({
        url: targetURL,
        active: !settings.resultsInBackgroundTab,
        index: index,
      });
    }
  },

  groupClicked: async function (info, tab) {
    var settings = await LocalStore.getOne(StoreKey.SETTINGS);
    var providers = await LocalStore.getOne(StoreKey.SEARCH_PROVIDERS);

    var groupIndex = parseInt(info.menuItemId.split("-")[1], 10);
    var groupItems = getGroupProviders(groupIndex, providers);
    var urls = _.map(groupItems, function (provider) {
      return getProviderTargetURL(provider, info.selectionText);
    });

    if (settings.openGroupsInNewWindow) {
      chrome.windows.create({
        url: urls,
        focused: !settings.resultsInBackgroundTab,
      });
    } else {
      var index = tab.index;
      for (var i = 0; i < urls.length; i++) {
        tabsApi.create({
          url: urls[i],
          active: !settings.resultsInBackgroundTab,
          index: settings.enableAdjacentTabs ? ++index : null,
        });
      }
    }
  },
};

function showPopupMessage(title, message) {
  try {
    chrome.notifications.create("", {
      title: title,
      message: message,
      iconUrl: "/images/icon_48.png",
      type: "basic",
    });
  } catch (err) {}
}

export default { installedListener, onClickedListener };
