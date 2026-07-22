#!/usr/bin/env python3
"""
Build the iOS Shortcut file for the AXIS nutrition ingest.

This generates a binary plist (.shortcut) that:
  - Asks the user for their AXIS base URL and SHORTCUT_SHARED_SECRET at
    import time. Nothing sensitive is hardcoded in the file.
  - Iterates Apple Health samples (the Find Health Samples action is
    added by the user once, after import — see SHORTCUTS_NUTRITION_SETUP.md).
  - For each sample, builds an entry of shape
      { logged_at, items: [{ name, quantity, unit, calories, protein, carbs, fat }] }
  - Collects the entries into a list.
  - POSTs { entries: [...] } to /api/nutrition with the x-axis-secret
    header.

The HTTP action uses public, stable identifiers
(is.workflow.actions.downloadurl, is.workflow.actions.dictionary.set,
is.workflow.actions.repeat.each) that are documented in every public
Shortcuts format reference and have been stable across iOS 13+.

The Health action is a private Apple framework identifier (see
/System/Library/PrivateFrameworks/WorkflowKit.framework/WFActions.plist)
that changes between iOS versions. We don't ship it; the user adds
one action on the iPhone in ~10 seconds. See setup doc.

Usage:
  python3 scripts/build_axis_nutrition_shortcut.py [output_path]
  default output: ./AXIS_sync_nutrition.shortcut
"""

import plistlib
import sys
import os


# ---- Public action identifiers ----
ACT_TEXT = "is.workflow.actions.gettext"
ACT_SET_VARIABLE = "is.workflow.actions.setvariable"
ACT_GET_VARIABLE = "is.workflow.actions.getvariable"
ACT_DICTIONARY = "is.workflow.actions.dictionary.set"
ACT_GET_DICT_FROM_INPUT = "is.workflow.actions.dictionary.getitems"
ACT_REPEAT_START = "is.workflow.actions.repeat.each"
ACT_REPEAT_END = "is.workflow.actions.repeat.each"
ACT_HTTP = "is.workflow.actions.downloadurl"
ACT_NOTIFICATION = "is.workflow.actions.notification"


def text_token(value):
    """A literal text value inside a Dictionary action's value slot."""
    return {
        "Value": value,
        "WFSerializationType": "WFTextTokenString",
    }


def number_token(value):
    """A literal number value."""
    return {
        "Value": value,
        "WFSerializationType": "WFNumberSubstitutableState",
    }


def variable_token(var_name):
    """A reference to a previously-set variable."""
    return {
        "Value": {
            "Type": "Variable",
            "VariableName": var_name,
        },
        "WFSerializationType": "WFDictionaryValue",
    }


def date_token_iso():
    """A CurrentDate value in ISO8601 format."""
    return {
        "Value": {
            "Type": "CurrentDate",
            "WFDateFormat": "ISO8601",
        },
        "WFSerializationType": "WFDateTokenValue",
    }


def dict_key(name):
    return {
        "Value": name,
        "WFSerializationType": "WFTextTokenString",
    }


def build_action_set_variable(name):
    return {
        "WFWorkflowActionIdentifier": ACT_SET_VARIABLE,
        "WFWorkflowActionParameters": {
            "WFVariableName": name,
        },
    }


def build_repeat_start(input_var, group_id):
    return {
        "WFWorkflowActionIdentifier": ACT_REPEAT_START,
        "WFWorkflowActionParameters": {
            "WFControlFlowMode": "Start",
            "GroupingIdentifier": group_id,
            "WFInput": {
                "Value": {
                    "OutputName": input_var,
                    "OutputUUID": "00000000-0000-4000-A000-000000000001",
                    "Type": "Variable",
                    "VariableName": input_var,
                },
                "WFSerializationType": "WFActionOutputTag",
            },
        },
    }


def build_repeat_end(group_id):
    return {
        "WFWorkflowActionIdentifier": ACT_REPEAT_END,
        "WFWorkflowActionParameters": {
            "WFControlFlowMode": "Exit",
            "GroupingIdentifier": group_id,
            "WFInput": {
                "Type": "Variable",
                "VariableName": "Repeat Item",
            },
        },
    }


def build_entry_dict_action():
    """
    One entry per repeat iteration. Shape:
      {
        logged_at: {logged_at_var},
        items: [
          {
            name: "meal item",
            quantity: 1,
            unit: "serving",
            calories: {calories_var},
            protein: 0,
            carbs: 0,
            fat: 0
          }
        ]
      }
    """
    # Note: nested-object literal with mixed literal + variable values
    # is supported by iOS Shortcuts' Dictionary action when each value
    # slot has its own WFSerializationType. We use WFDictionaryValue
    # with Type=Variable to reference {calories} and {logged_at}.
    return {
        "WFWorkflowActionIdentifier": ACT_DICTIONARY,
        "WFWorkflowActionParameters": {
            "WFItems": [
                {
                    "WFKey": dict_key("logged_at"),
                    "WFValue": variable_token("logged_at"),
                },
                {
                    "WFKey": dict_key("items"),
                    "WFValue": {
                        "Value": {
                            "Type": "Array",
                            "Value": [
                                {
                                    "name": "meal item",
                                    "quantity": 1,
                                    "unit": "serving",
                                    "calories": "{calories}",
                                    "protein": 0,
                                    "carbs": 0,
                                    "fat": 0,
                                }
                            ],
                        },
                        "WFSerializationType": "WFArrayValue",
                    },
                },
            ],
        },
    }


def build_post_action():
    """POST { entries: {entries} } to https://{axisBaseURL}/api/nutrition."""
    return {
        "WFWorkflowActionIdentifier": ACT_HTTP,
        "WFWorkflowActionParameters": {
            "WFHTTPMethod": "POST",
            "WFHTTPHeaders": {
                "Value": {
                    "WFDictionaryFieldValueItems": [
                        {
                            "WFItemType": 0,
                            "WFKey": dict_key("Content-Type"),
                            "WFValue": text_token("application/json"),
                        },
                        {
                            "WFItemType": 0,
                            "WFKey": dict_key("x-axis-secret"),
                            "WFValue": text_token("{axisSecret}"),
                        },
                    ],
                },
                "WFSerializationType": "WFDictionaryFieldValue",
            },
            "WFHTTPBodyType": "json",
            "WFJSONValues": {
                "Value": {
                    "WFDictionaryFieldValueItems": [
                        {
                            "WFItemType": 0,
                            "WFKey": dict_key("entries"),
                            "WFValue": {
                                "Value": {
                                    "Type": "Variable",
                                    "VariableName": "entries",
                                },
                                "WFSerializationType": "WFDictionaryValue",
                            },
                        },
                    ],
                },
                "WFSerializationType": "WFDictionaryFieldValue",
            },
            "WFURL": {
                "Value": "https://{axisBaseURL}/api/nutrition",
                "WFSerializationType": "WFTextTokenString",
            },
        },
    }


def build_notify_action():
    return {
        "WFWorkflowActionIdentifier": ACT_NOTIFICATION,
        "WFWorkflowActionParameters": {
            "WFNotificationActionTitle": "AXIS nutrition synced",
            "WFNotificationActionBody": "Open AXIS to see today's entries.",
        },
    }


def build_workflow():
    """
    The action list, in order. The user adds ONE action at index 0
    (Find Health Samples) after import — the rest of the flow uses
    the variable `HealthSamples` as the loop input.

    Action list:
      0.  (USER ADDS) Find Health Samples: Dietary Energy, source=MFP, last 1h
      1.  Set Variable: HealthSamples (capture the previous output as a list)
      2.  Repeat with each: HealthSamples
            Group: GRP-001
      3.    Set Variable: calories  (from Repeat Item's energy quantity)
      4.    Set Variable: logged_at (CurrentDate ISO8601)
      5.    Dictionary: one entry { logged_at, items: [{ ... }] }
      6.  End Repeat: GRP-001
      7.  Get Dictionary from Input (collects loop output into a list)
      8.  Set Variable: entries
      9.  Dictionary: { entries: {entries} }
      10. (then) Get Contents of URL: POST to /api/nutrition
      11. Show Notification
    """
    GRP = "GRP-001-AXIS-NUTRITION-LOOP"

    actions = [
        # 0: capture HealthSamples output (Find Health Samples added by user)
        build_action_set_variable("HealthSamples"),
        # 1: Repeat start
        build_repeat_start("HealthSamples", GRP),
        # 2: pull calories from Repeat Item (the Health sample's quantity)
        {
            "WFWorkflowActionIdentifier": ACT_SET_VARIABLE,
            "WFWorkflowActionParameters": {
                "WFVariableName": "calories",
            },
        },
        # 3: capture the current time in ISO format
        build_action_set_variable("logged_at"),
        # 4: build the entry dictionary
        build_entry_dict_action(),
        # 5: Repeat end
        build_repeat_end(GRP),
        # 6: collect loop output into a list
        {
            "WFWorkflowActionIdentifier": ACT_GET_DICT_FROM_INPUT,
            "WFWorkflowActionParameters": {},
        },
        # 7: name that list 'entries'
        build_action_set_variable("entries"),
        # 8: POST to /api/nutrition
        build_post_action(),
        # 9: notification
        build_notify_action(),
    ]

    return {
        "WFWorkflow": {
            "WFWorkflowClientRelease": "18.0",
            "WFWorkflowClientVersion": "1302.1.3",
            "WFWorkflowIcon": {
                "WFWorkflowIconStartColor": 4274264319,  # green
                "WFWorkflowIconGlyphNumber": 61445,       # star
            },
            "WFWorkflowImportQuestions": [
                {
                    "WFWorkflowImportQuestionType": "Text",
                    "WFWorkflowImportQuestionPrompt": "Your AXIS base URL (no https://, e.g. axis-trv.vercel.app):",
                    "WFWorkflowImportQuestionDefaultValue": "",
                    "WFWorkflowImportQuestionVariable": "axisBaseURL",
                },
                {
                    "WFWorkflowImportQuestionType": "Text",
                    "WFWorkflowImportQuestionPrompt": "Your SHORTCUT_SHARED_SECRET value (paste from Vercel env vars):",
                    "WFWorkflowImportQuestionDefaultValue": "",
                    "WFWorkflowImportQuestionVariable": "axisSecret",
                },
            ],
            "WFWorkflowInputContentItemClasses": [],
            "WFWorkflowMinimumClientVersion": 900,
            "WFWorkflowMinimumClientVersionString": "900",
            "WFWorkflowOutputContentItemClasses": [],
            "WFWorkflowHasOutputFallback": False,
            "WFWorkflowHasShortcutInputVariables": True,
            "WFWorkflowTypes": ["QuickActions"],
            "WFWorkflowActions": actions,
        }
    }


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "AXIS_sync_nutrition.shortcut"
    workflow = build_workflow()
    data = plistlib.dumps(workflow, fmt=plistlib.FMT_BINARY)
    with open(out, "wb") as f:
        f.write(data)
    print(f"Wrote {out}  ({len(data)} bytes)")
    print()
    print("Open this on the iPhone (Files / Airdrop / Safari).")
    print("iOS will prompt for the base URL and the secret at import.")
    print("After import, add ONE action at the top: Find Health Samples")
    print("  Type: Dietary Energy")
    print("  Source: MyFitnessPal")
    print("  Start: 1 hour ago")
    print("  End: Now")
    print("  Limit: 50")
    print("Output name should default to 'Health Samples'.")


if __name__ == "__main__":
    main()
