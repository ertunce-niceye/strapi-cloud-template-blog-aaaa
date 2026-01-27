import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, GridItem, Loader } from '@strapi/design-system';
import { Field, FieldLabel, FieldHint } from '@strapi/design-system';
import { useFetchClient } from '@strapi/helper-plugin';
import styled from 'styled-components';

// Import preview images
import defaultPreview from '../assets/template-previews/default.png';
import modernPreview from '../assets/template-previews/modern.png';
import classicPreview from '../assets/template-previews/classic.png';

const TEMPLATE_PREVIEWS = {
    default: defaultPreview,
    modern: modernPreview,
    classic: classicPreview,
    minimal: classicPreview, // Reuse classic for now
    corporate: defaultPreview, // Reuse default for now
};

const TemplateCard = styled.button`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
  border: 3px solid ${props => props.$selected ? '#4945ff' : '#dcdce4'};
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
  width: 100%;

  &:hover {
    border-color: #4945ff;
    box-shadow: 0 4px 12px rgba(73, 69, 255, 0.15);
    transform: translateY(-2px);
  }

  &:focus {
    outline: none;
    border-color: #4945ff;
    box-shadow: 0 0 0 4px rgba(73, 69, 255, 0.1);
  }
`;

const TemplatePreview = styled.div`
  width: 100%;
  height: 180px;
  background-image: url(${props => props.$image});
  background-size: cover;
  background-position: center;
  background-color: #f6f6f9;
  position: relative;

  ${props => props.$selected && `
    &::after {
      content: '✓';
      position: absolute;
      top: 8px;
      right: 8px;
      width: 28px;
      height: 28px;
      background: #4945ff;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: bold;
    }
  `}
`;

const TemplateInfo = styled.div`
  padding: 12px 16px;
  text-align: left;
`;

const TemplateName = styled.div`
  font-size: 14px;
  font-weight: ${props => props.$selected ? '600' : '500'};
  color: ${props => props.$selected ? '#4945ff' : '#32324d'};
  margin-bottom: 4px;
`;

const TemplateVariant = styled.div`
  font-size: 12px;
  color: #666687;
  text-transform: capitalize;
`;

const TemplateDescription = styled.div`
  font-size: 12px;
  color: #8e8ea9;
  margin-top: 4px;
  line-height: 1.4;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #666687;
`;

const TemplateSelectorField = ({ name, value, onChange, required, hint, label }) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState(value?.id || value || null);
    const { get } = useFetchClient();

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                setLoading(true);
                const { data } = await get('/page-templates?populate=*');
                setTemplates(data?.data || []);
            } catch (error) {
                console.error('Error fetching templates:', error);
                setTemplates([]);
            } finally {
                setLoading(false);
            }
        };

        fetchTemplates();
    }, [get]);

    const handleSelectTemplate = (templateId) => {
        setSelectedTemplate(templateId);
        onChange({ target: { name, value: templateId } });
    };

    if (loading) {
        return (
            <Field name={name} required={required}>
                <FieldLabel>{label || 'Page Template'}</FieldLabel>
                <Box paddingTop={2} paddingBottom={2}>
                    <Loader>Loading templates...</Loader>
                </Box>
            </Field>
        );
    }

    if (templates.length === 0) {
        return (
            <Field name={name} required={required}>
                <FieldLabel>{label || 'Page Template'}</FieldLabel>
                <EmptyState>
                    <Typography variant="omega">No templates available</Typography>
                    <Typography variant="pi" textColor="neutral600">
                        Create templates in the Page Templates collection first
                    </Typography>
                </EmptyState>
            </Field>
        );
    }

    return (
        <Field name={name} required={required}>
            <FieldLabel>{label || 'Page Template'}</FieldLabel>
            <Box paddingTop={2}>
                <Grid gap={4}>
                    {templates.map((template) => {
                        const templateData = template.attributes || template;
                        const templateId = template.id || template.documentId;
                        const variant = (templateData.StyleVariant || 'default').toLowerCase();
                        const previewImage = TEMPLATE_PREVIEWS[variant] || TEMPLATE_PREVIEWS.default;

                        return (
                            <GridItem key={templateId} col={4} s={6} xs={12}>
                                <TemplateCard
                                    type="button"
                                    $selected={selectedTemplate === templateId}
                                    onClick={() => handleSelectTemplate(templateId)}
                                >
                                    <TemplatePreview
                                        $image={previewImage}
                                        $selected={selectedTemplate === templateId}
                                    />
                                    <TemplateInfo>
                                        <TemplateName $selected={selectedTemplate === templateId}>
                                            {templateData.TemplateName || 'Unnamed Template'}
                                        </TemplateName>
                                        <TemplateVariant>
                                            {variant}
                                        </TemplateVariant>
                                        {templateData.Description && (
                                            <TemplateDescription>
                                                {templateData.Description.length > 60
                                                    ? `${templateData.Description.substring(0, 60)}...`
                                                    : templateData.Description}
                                            </TemplateDescription>
                                        )}
                                    </TemplateInfo>
                                </TemplateCard>
                            </GridItem>
                        );
                    })}
                </Grid>
            </Box>
            {hint && <FieldHint>{hint}</FieldHint>}
        </Field>
    );
};

export default TemplateSelectorField;
