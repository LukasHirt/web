Feature: access breadcrumb
  As a user
  I want to browse to parent folders using breadcrumb
  So that I can access resources with ease

  Background:
    Given user "Alice" has been created with default attributes and without skeleton files in the server


  Scenario: Breadcrumb navigation should not happen on last segment
    Given user "Alice" has created folder "simple-folder" in the server
    And user "Alice" has created folder "simple-folder/subfolder" in the server
    And user "Alice" has logged in using the webUI
    When the user opens folder "simple-folder" using the webUI
    And the user opens folder "subfolder" using the webUI
    Then breadcrumb for folder "simple-folder" should be displayed on the webUI
    And breadcrumb for folder "subfolder" should be displayed on the webUI
    And non-clickable breadcrumb for folder "subfolder" should be present on the webUI


  Scenario: Select breadcrumb inside folder with problematic name
    Given user "Alice" has created folder "folder%2Fwith%2FSlashes" in the server
    And user "Alice" has created folder "folder%2Fwith%2FSlashes/subfolder" in the server
    And user "Alice" has logged in using the webUI
    When the user opens folder "folder%2Fwith%2FSlashes" using the webUI
    And the user opens folder "subfolder" using the webUI
    And the user browses to folder "folder%2Fwith%2FSlashes" using the breadcrumb on the webUI
    Then no message should be displayed on the webUI


  Scenario: Reload webUI inside the problematic folder
    Given user "Alice" has created folder "folder%2Fwith%2FSlashes" in the server
    And user "Alice" has logged in using the webUI
    When the user opens folder "folder%2Fwith%2FSlashes" using the webUI
    And the user reloads the current page of the webUI
    Then no message should be displayed on the webUI


  Scenario: breadcrumb for double quotes
    Given user "Alice" has created folder "\'single-double quotes\"" in the server
    And user "Alice" has created folder "\'single-double quotes\"/\"inner\" double quotes" in the server
    And user "Alice" has logged in using the webUI
    When the user opens folder "\'single-double quotes\"" using the webUI
    And the user opens folder "\"inner\" double quotes" using the webUI
    Then breadcrumb for folder "\'single-double quotes\"" should be displayed on the webUI
    And breadcrumb for folder "\"inner\" double quotes" should be displayed on the webUI
    And non-clickable breadcrumb for folder "\"inner\" double quotes" should be present on the webUI
