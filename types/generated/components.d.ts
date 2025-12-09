import type { Schema, Struct } from '@strapi/strapi';

export interface FormFieldsFieldConsentCheckbox extends Struct.ComponentSchema {
  collectionName: 'components_form_fields_field_consent_checkboxes';
  info: {
    displayName: 'Field_Consent_Checkbox';
  };
  attributes: {
    Compliance_Tag: Schema.Attribute.Enumeration<
      [
        'E-consent',
        'Privacy Policy ',
        'Terms of Use',
        'GDPR',
        'KVKK',
        'HIPAA',
        'Others',
      ]
    >;
    Consent_Text: Schema.Attribute.Blocks;
    Is_Required: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    Label: Schema.Attribute.String;
  };
}

export interface FormFieldsFieldCountryPicker extends Struct.ComponentSchema {
  collectionName: 'components_form_fields_field_country_pickers';
  info: {
    displayName: 'Field_CountryPicker';
  };
  attributes: {
    Is_Required: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    Label: Schema.Attribute.String;
  };
}

export interface FormFieldsFieldDropdownSelect extends Struct.ComponentSchema {
  collectionName: 'components_form_fields_field_dropdown_selects';
  info: {
    displayName: 'Field_Dropdown_Select';
  };
  attributes: {
    Is_Required: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    Label: Schema.Attribute.String;
    Options_List: Schema.Attribute.Component<'form-fields.option-value', true>;
  };
}

export interface FormFieldsFieldEmailAddress extends Struct.ComponentSchema {
  collectionName: 'components_form_fields_field_email_addresses';
  info: {
    displayName: 'Field_Email_Address';
  };
  attributes: {
    Is_Required: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    Label: Schema.Attribute.String;
    Placeholder: Schema.Attribute.String;
  };
}

export interface FormFieldsFieldTextInput extends Struct.ComponentSchema {
  collectionName: 'components_form_fields_field_text_inputs';
  info: {
    displayName: 'Field_Text_Input';
  };
  attributes: {
    Is_Required: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    Label: Schema.Attribute.String;
    Placeholder: Schema.Attribute.String;
  };
}

export interface FormFieldsOptionValue extends Struct.ComponentSchema {
  collectionName: 'components_form_fields_option_values';
  info: {
    displayName: 'Option_Value';
  };
  attributes: {
    Is_Required: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    Value: Schema.Attribute.String;
  };
}

export interface GlobalFooterActionLink extends Struct.ComponentSchema {
  collectionName: 'components_global_footer_action_links';
  info: {
    displayName: 'Footer_Action_Link';
  };
  attributes: {
    Label: Schema.Attribute.String;
    URL: Schema.Attribute.String;
  };
}

export interface GlobalNavigationLink extends Struct.ComponentSchema {
  collectionName: 'components_global_navigation_links';
  info: {
    displayName: 'Navigation_Link';
  };
  attributes: {
    Label: Schema.Attribute.String;
    Open_In_New_Tab: Schema.Attribute.Boolean;
    URL: Schema.Attribute.String;
  };
}

export interface LivePageLiveCtaBlock extends Struct.ComponentSchema {
  collectionName: 'components_live_page_live_cta_blocks';
  info: {
    displayName: 'Live_CTA_Block';
  };
  attributes: {
    Buttons: Schema.Attribute.Component<
      'webinar-details.custom-action-button',
      true
    >;
    Title: Schema.Attribute.String;
  };
}

export interface LivePageLiveQAPanel extends Struct.ComponentSchema {
  collectionName: 'components_live_page_live_q_a_panels';
  info: {
    displayName: 'Live_Q_A_Panel';
  };
  attributes: {
    Description: Schema.Attribute.Blocks;
    Title: Schema.Attribute.String;
  };
}

export interface LivePageLiveResourcesBlock extends Struct.ComponentSchema {
  collectionName: 'components_live_page_live_resources_blocks';
  info: {
    displayName: 'Live_Resources_Block';
  };
  attributes: {
    Resources: Schema.Attribute.Component<
      'webinar-details.custom-action-button',
      true
    >;
    Title: Schema.Attribute.String;
  };
}

export interface PageSectionsAgendaItem extends Struct.ComponentSchema {
  collectionName: 'components_page_sections_agenda_items';
  info: {
    displayName: 'Agenda_Item';
  };
  attributes: {
    Speaker_Relation: Schema.Attribute.Relation<
      'oneToMany',
      'api::speaker.speaker'
    >;
    Time_Slot: Schema.Attribute.String & Schema.Attribute.Required;
    Topic_Title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface PageSectionsBlockRegistrationUi
  extends Struct.ComponentSchema {
  collectionName: 'components_page_sections_block_registration_uis';
  info: {
    displayName: 'Block_Registration_UI';
  };
  attributes: {
    Enable_Sign_In_Only: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
  };
}

export interface PageSectionsBlockSessionCards extends Struct.ComponentSchema {
  collectionName: 'components_page_sections_block_session_cards';
  info: {
    displayName: 'Block_Session_Cards';
  };
  attributes: {
    Card_Style: Schema.Attribute.Enumeration<['Simple', 'Detailed Speaker']>;
    Title: Schema.Attribute.String;
  };
}

export interface PageSectionsRichTextContent extends Struct.ComponentSchema {
  collectionName: 'components_page_sections_rich_text_contents';
  info: {
    displayName: 'Rich_Text_Content';
  };
  attributes: {
    Body_Content: Schema.Attribute.Blocks;
  };
}

export interface PageSectionsSectionAgendaBlock extends Struct.ComponentSchema {
  collectionName: 'components_page_sections_section_agenda_blocks';
  info: {
    displayName: 'Section_Agenda_Block';
  };
  attributes: {
    Agenda_Items: Schema.Attribute.Component<'page-sections.agenda-item', true>;
  };
}

export interface PageSectionsSectionHero extends Struct.ComponentSchema {
  collectionName: 'components_page_sections_section_heroes';
  info: {
    displayName: 'Section_Hero';
  };
  attributes: {
    Description: Schema.Attribute.Text;
    Headline: Schema.Attribute.String & Schema.Attribute.Required;
    Image: Schema.Attribute.Media<'images' | 'videos', true> &
      Schema.Attribute.Required;
  };
}

export interface PageSectionsSectionSpeakerGrid extends Struct.ComponentSchema {
  collectionName: 'components_page_sections_section_speaker_grids';
  info: {
    displayName: 'Section_Speaker_Grid';
  };
  attributes: {
    Bio_button: Schema.Attribute.String;
    Show_Bio_Popup: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    Title: Schema.Attribute.String;
  };
}

export interface SharedMedia extends Struct.ComponentSchema {
  collectionName: 'components_shared_media';
  info: {
    displayName: 'Media';
    icon: 'file-video';
  };
  attributes: {
    file: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
  };
}

export interface SharedQuote extends Struct.ComponentSchema {
  collectionName: 'components_shared_quotes';
  info: {
    displayName: 'Quote';
    icon: 'indent';
  };
  attributes: {
    body: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SharedRichText extends Struct.ComponentSchema {
  collectionName: 'components_shared_rich_texts';
  info: {
    description: '';
    displayName: 'Rich text';
    icon: 'align-justify';
  };
  attributes: {
    body: Schema.Attribute.RichText;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: '';
    displayName: 'Seo';
    icon: 'allergies';
    name: 'Seo';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    metaTitle: Schema.Attribute.String & Schema.Attribute.Required;
    shareImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedSlider extends Struct.ComponentSchema {
  collectionName: 'components_shared_sliders';
  info: {
    description: '';
    displayName: 'Slider';
    icon: 'address-book';
  };
  attributes: {
    files: Schema.Attribute.Media<'images', true>;
  };
}

export interface WebinarDetailsCustomActionButton
  extends Struct.ComponentSchema {
  collectionName: 'components_webinar_details_custom_action_buttons';
  info: {
    displayName: 'Custom_Action_Button';
  };
  attributes: {
    Button_Label: Schema.Attribute.String;
    Button_Style: Schema.Attribute.Enumeration<
      ['Primary', 'Secondary', 'Hidden']
    >;
    Link_URL: Schema.Attribute.String;
  };
}

export interface WebinarDetailsEmailAutomationSettings
  extends Struct.ComponentSchema {
  collectionName: 'components_webinar_details_email_automation_settings';
  info: {
    displayName: 'Email_Automation_Settings';
  };
  attributes: {
    Confirmation_Email_Content: Schema.Attribute.Blocks;
    Post_Webinar_Follow_Up_Email_Content: Schema.Attribute.Blocks;
    Reminder_Emails: Schema.Attribute.Component<
      'webinar-details.reminder-email',
      true
    >;
  };
}

export interface WebinarDetailsReminderEmail extends Struct.ComponentSchema {
  collectionName: 'components_webinar_details_reminder_emails';
  info: {
    displayName: 'Reminder_Email';
  };
  attributes: {
    Days_Before_Event: Schema.Attribute.Integer;
    Email_Body: Schema.Attribute.Blocks;
    Email_Subject: Schema.Attribute.String;
    Internal_Label: Schema.Attribute.String;
    Template_ID: Schema.Attribute.String;
  };
}

export interface WebinarDetailsZoomEventSetup extends Struct.ComponentSchema {
  collectionName: 'components_webinar_details_zoom_event_setups';
  info: {
    displayName: 'Zoom_Event_Setup';
  };
  attributes: {
    Embed_Method: Schema.Attribute.Enumeration<['websdk', 'zoom_link']> &
      Schema.Attribute.DefaultTo<'websdk'>;
    Enable_Backstage_Settings: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    Event_Duration_Minutes: Schema.Attribute.Integer;
    Internal_Label: Schema.Attribute.String;
    Use_This_Zoom_Setup: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    Zoom_Host_Email: Schema.Attribute.String & Schema.Attribute.Required;
    Zoom_Passcode: Schema.Attribute.String;
    Zoom_Webinar_ID: Schema.Attribute.String;
    Zoom_Webinar_UUID: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'form-fields.field-consent-checkbox': FormFieldsFieldConsentCheckbox;
      'form-fields.field-country-picker': FormFieldsFieldCountryPicker;
      'form-fields.field-dropdown-select': FormFieldsFieldDropdownSelect;
      'form-fields.field-email-address': FormFieldsFieldEmailAddress;
      'form-fields.field-text-input': FormFieldsFieldTextInput;
      'form-fields.option-value': FormFieldsOptionValue;
      'global.footer-action-link': GlobalFooterActionLink;
      'global.navigation-link': GlobalNavigationLink;
      'live-page.live-cta-block': LivePageLiveCtaBlock;
      'live-page.live-q-a-panel': LivePageLiveQAPanel;
      'live-page.live-resources-block': LivePageLiveResourcesBlock;
      'page-sections.agenda-item': PageSectionsAgendaItem;
      'page-sections.block-registration-ui': PageSectionsBlockRegistrationUi;
      'page-sections.block-session-cards': PageSectionsBlockSessionCards;
      'page-sections.rich-text-content': PageSectionsRichTextContent;
      'page-sections.section-agenda-block': PageSectionsSectionAgendaBlock;
      'page-sections.section-hero': PageSectionsSectionHero;
      'page-sections.section-speaker-grid': PageSectionsSectionSpeakerGrid;
      'shared.media': SharedMedia;
      'shared.quote': SharedQuote;
      'shared.rich-text': SharedRichText;
      'shared.seo': SharedSeo;
      'shared.slider': SharedSlider;
      'webinar-details.custom-action-button': WebinarDetailsCustomActionButton;
      'webinar-details.email-automation-settings': WebinarDetailsEmailAutomationSettings;
      'webinar-details.reminder-email': WebinarDetailsReminderEmail;
      'webinar-details.zoom-event-setup': WebinarDetailsZoomEventSetup;
    }
  }
}
