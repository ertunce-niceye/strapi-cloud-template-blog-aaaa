import React, { useEffect, useRef } from 'react';
import { Box } from '@strapi/design-system';

const TemplateConfiguratorIframe = ({ onChange, value }) => {
    const iframeRef = useRef(null);
    const CONFIGURATOR_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

    useEffect(() => {
        // Listen for messages from iframe
        const handleMessage = (event) => {
            // Security: check origin
            if (!event.origin.includes('localhost:3000')) {
                return;
            }

            if (event.data.type === 'TEMPLATE_SELECTED') {
                // Update Strapi fields
                const { templateId, colorPalette } = event.data.data;

                // Trigger onChange for both fields
                if (onChange) {
                    onChange({
                        target: {
                            name: 'PageTemplate',
                            value: templateId,
                            type: 'relation'
                        }
                    });

                    // Also update ColorPalette field
                    setTimeout(() => {
                        onChange({
                            target: {
                                name: 'ColorPalette',
                                value: colorPalette,
                                type: 'json'
                            }
                        });
                    }, 100);
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onChange]);

    // Send initial data to iframe when it loads
    useEffect(() => {
        const sendInitData = () => {
            if (iframeRef.current && iframeRef.current.contentWindow) {
                iframeRef.current.contentWindow.postMessage({
                    type: 'INIT_CONFIGURATOR',
                    data: {
                        templateId: value?.PageTemplate || null,
                        paletteId: value?.ColorPalette?.id || null,
                    }
                }, '*');
            }
        };

        // Wait for iframe to load
        const timer = setTimeout(sendInitData, 1000);
        return () => clearTimeout(timer);
    }, [value]);

    return (
        <Box padding={4} background="neutral100" hasRadius>
            <iframe
                ref={iframeRef}
                src={`${CONFIGURATOR_URL}/admin/template-configurator`}
                style={{
                    width: '100%',
                    height: '700px',
                    border: '1px solid #dcdce4',
                    borderRadius: '4px',
                }}
                title="Template Configurator"
            />
        </Box>
    );
};

export default TemplateConfiguratorIframe;
