/**
 * 合同详情页 Alpine.js 组件
 */

function contractDetailApp(config = {}) {
    const contractId = config.contractId;
    const storageKey = 'contractDetailTab';

    return {
        activeTab: localStorage.getItem(storageKey) || 'basic',
        generating: false,
        generatingType: null,
        splitFee: true,

        folderUnlocked: false,
        get folderLockIcon() {
            const locked = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>';
            const unlocked = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>';
            return this.folderUnlocked ? unlocked : locked;
        },

        showAgreementDialog: false,
        selectedAgreementId: null,

        showPreviewDialog: false,
        showAgreementPreviewSelect: false,
        previewAgreementId: null,
        previewTitle: '',
        previewRows: [],
        isLoadingPreview: false,
        previewEditMode: false,
        previewHasOverrides: false,
        previewContractId: null,
        previewTemplateSubtype: null,

        toasts: [],

        init() {
            this.$watch('activeTab', (value) => {
                localStorage.setItem(storageKey, value);
            });

            window.addEventListener('contract-folder-scan-needs-binding', () => {
                this.activeTab = 'documents';
                this.showToast('请先在"文档与提醒"中完成文件夹绑定，再使用"从合同文件夹同步"', 'error');
            });
            // 监听归档文书预览事件
            this.$el.addEventListener('archive-preview-open', (e) => {
                const { contractId: cid, templateSubtype, templateName, editMode } = e.detail;
                this.previewTitle = templateName + ' - 替换词预览';
                this.previewRows = [];
                this.isLoadingPreview = true;
                this.showPreviewDialog = true;
                this.previewEditMode = false;
                this.previewHasOverrides = false;
                this.previewContractId = cid;
                this.previewTemplateSubtype = templateSubtype;
                const shouldEdit = editMode === true;
                fetch(`/api/v1/documents/contracts/${cid}/archive-preview?template_subtype=${encodeURIComponent(templateSubtype)}`)
                    .then(r => r.json())
                    .then(result => {
                        if (result.success && result.data) {
                            this.previewRows = result.data.map(r => ({...r, editValue: r.value || ''}));
                            this.previewHasOverrides = !!result.has_overrides;
                            if (shouldEdit) {
                                this.previewEditMode = true;
                            }
                        } else {
                            this.showToast('预览失败: ' + (result.error || '未知错误'), 'error');
                            this.showPreviewDialog = false;
                        }
                    })
                    .catch(err => {
                        this.showToast('预览请求失败: ' + err.message, 'error');
                        this.showPreviewDialog = false;
                    })
                    .finally(() => {
                        this.isLoadingPreview = false;
                    });
            });
        },

        showToast(message, type = 'success') {
            const toast = { message, type, show: true };
            this.toasts.push(toast);

            setTimeout(() => {
                toast.show = false;
                setTimeout(() => {
                    const index = this.toasts.indexOf(toast);
                    if (index > -1) {
                        this.toasts.splice(index, 1);
                    }
                }, 300);
            }, 3000);
        },

        getCsrfToken() {
            return (window.FachuanCSRF && window.FachuanCSRF.getToken && window.FachuanCSRF.getToken()) || '';
        },

        /**
         * 进入预览编辑模式
         */
        enterPreviewEditMode() {
            this.previewEditMode = true;
            // 将当前值复制到 editValue
            this.previewRows.forEach(row => {
                if (!row.editValue && row.editValue !== '') {
                    row.editValue = row.value || '';
                }
            });
        },

        /**
         * 放弃修改，退出编辑模式（不删除已保存的覆盖值）
         */
        cancelPreviewEdit() {
            this.previewEditMode = false;
        },

        /**
         * 撤销已保存的修改，恢复自动值
         */
        async revertPreviewOverrides() {
            if (!this.previewContractId || !this.previewTemplateSubtype) return;

            try {
                const resp = await fetch(
                    `/api/v1/documents/contracts/${this.previewContractId}/archive-placeholder-overrides?template_subtype=${encodeURIComponent(this.previewTemplateSubtype)}`,
                    {
                        method: 'DELETE',
                        headers: { 'X-CSRFToken': this.getCsrfToken() },
                    }
                );
                const data = await resp.json();
                if (data.success) {
                    this.previewHasOverrides = false;
                    // 重新加载预览以恢复自动值
                    this.showPreviewDialog = false;
                    setTimeout(() => {
                        const app = document.querySelector('.contract-detail-page');
                        if (app) {
                            app.dispatchEvent(new CustomEvent('archive-preview-open', {
                                detail: {
                                    contractId: this.previewContractId,
                                    templateSubtype: this.previewTemplateSubtype,
                                    templateName: this.previewTitle.replace(' - 替换词预览', ''),
                                    editMode: false,
                                },
                                bubbles: true,
                            }));
                        }
                    }, 200);
                    this.showToast('已撤销修改，恢复为自动值', 'success');
                } else {
                    this.showToast('撤销失败: ' + (data.error || '未知错误'), 'error');
                }
            } catch (err) {
                this.showToast('撤销请求失败: ' + err.message, 'error');
            }
        },

        /**
         * 保存覆盖值
         */
        async savePreviewOverrides() {
            if (!this.previewContractId || !this.previewTemplateSubtype) return;

            // 收集有修改的值
            const overrides = {};
            this.previewRows.forEach(row => {
                const editVal = (row.editValue || '').trim();
                const origVal = (row.value || '').trim();
                if (editVal !== origVal) {
                    overrides[row.key] = editVal;
                }
            });

            try {
                const resp = await fetch(
                    `/api/v1/documents/contracts/${this.previewContractId}/archive-placeholder-overrides?template_subtype=${encodeURIComponent(this.previewTemplateSubtype)}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': this.getCsrfToken(),
                        },
                        body: JSON.stringify({ overrides }),
                    }
                );
                const data = await resp.json();
                if (data.success) {
                    // 用编辑后的值更新显示
                    this.previewRows.forEach(row => {
                        if (row.editValue !== undefined && row.editValue.trim() !== '') {
                            row.value = row.editValue;
                            row.status = 'ok';
                        }
                    });
                    this.previewEditMode = false;
                    this.previewHasOverrides = true;
                    this.showToast('保存成功，预览和下载将使用修改后的值', 'success');
                } else {
                    this.showToast('保存失败: ' + (data.error || '未知错误'), 'error');
                }
            } catch (err) {
                this.showToast('保存请求失败: ' + err.message, 'error');
            }
        },

        /**
         * 处理文件下载响应
         * @param {Response} response - fetch 响应对象
         * @param {string} defaultFilename - 默认文件名
         */
        async handleDownloadResponse(response, defaultFilename) {
            const blob = await response.blob();
            const contentDisposition = response.headers.get('content-disposition');
            let filename = defaultFilename;

            if (contentDisposition) {
                const utf8Match = contentDisposition.match(/filename\*=UTF-8''(.+)/);
                if (utf8Match) {
                    filename = decodeURIComponent(utf8Match[1]);
                } else {
                    const simpleMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
                    if (simpleMatch) {
                        filename = simpleMatch[1];
                    }
                }
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            return filename;
        },

        async generateContract() {
            if (this.generating || !contractId) return;

            this.generating = true;
            this.generatingType = 'contract';

            try {
                const response = await fetch(`/api/v1/documents/contracts/${contractId}/download?split_fee=${this.splitFee}`);

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || errorData.detail || '生成失败');
                }

                const contentType = response.headers.get('content-type');

                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    this.showToast(data.message || '合同已生成并保存', 'success');
                } else {
                    await this.handleDownloadResponse(response, '合同.docx');
                    this.showToast('合同生成成功，已开始下载', 'success');
                }
            } catch (error) {
                console.error('生成合同失败:', error);
                this.showToast(error.message || '生成合同失败', 'error');
            } finally {
                this.generating = false;
                this.generatingType = null;
            }
        },

        async generateSupplementaryAgreement() {
            if (this.generating || !this.selectedAgreementId || !contractId) return;

            this.generating = true;
            this.generatingType = 'agreement';
            this.showAgreementDialog = false;

            try {
                const response = await fetch(
                    `/api/v1/documents/contracts/${contractId}/supplementary-agreements/${this.selectedAgreementId}/download`
                );

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || errorData.detail || '生成失败');
                }

                const contentType = response.headers.get('content-type');

                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    this.showToast(data.message || '补充协议已生成并保存', 'success');
                } else {
                    await this.handleDownloadResponse(response, '补充协议.docx');
                    this.showToast('补充协议生成成功，已开始下载', 'success');
                }
            } catch (error) {
                console.error('生成补充协议失败:', error);
                this.showToast(error.message || '生成补充协议失败', 'error');
            } finally {
                this.generating = false;
                this.generatingType = null;
                this.selectedAgreementId = null;
            }
        },

        async generateFolder() {
            if (this.generating || !this.folderUnlocked || !contractId) return;

            this.generating = true;
            this.generatingType = 'folder';

            try {
                const response = await fetch(`/api/v1/documents/contracts/${contractId}/folder/download`);

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || errorData.detail || '生成失败');
                }

                const contentType = response.headers.get('content-type');

                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    this.showToast(data.message || '文件夹已生成并保存到绑定目录', 'success');
                } else {
                    await this.handleDownloadResponse(response, '文件夹.zip');
                    this.showToast('文件夹生成成功，已开始下载', 'success');
                }
            } catch (error) {
                console.error('生成文件夹失败:', error);
                this.showToast(error.message || '生成文件夹失败', 'error');
            } finally {
                this.generating = false;
                this.generatingType = null;
                this.folderUnlocked = false;
            }
        },

        openAgreementDialog() {
            this.selectedAgreementId = null;
            this.showAgreementDialog = true;
        },

        closeAgreementDialog() {
            this.showAgreementDialog = false;
            this.selectedAgreementId = null;
        },

        selectAgreement(agreementId) {
            this.selectedAgreementId = agreementId;
        },

        async previewContract() {
            this.previewTitle = '合同替换词预览';
            this.previewRows = [];
            this.isLoadingPreview = true;
            this.showPreviewDialog = true;

            try {
                const resp = await fetch(`/api/v1/documents/contracts/${contractId}/preview`);
                const data = await resp.json();
                this.previewRows = data.data || [];
            } catch (e) {
                this.showToast('预览加载失败', 'error');
            } finally {
                this.isLoadingPreview = false;
            }
        },

        openAgreementPreviewDialog() {
            this.previewAgreementId = null;
            this.showAgreementPreviewSelect = true;
        },

        async previewAgreement() {
            if (!this.previewAgreementId) return;

            this.showAgreementPreviewSelect = false;
            this.previewTitle = '补充协议替换词预览';
            this.previewRows = [];
            this.isLoadingPreview = true;
            this.showPreviewDialog = true;

            try {
                const resp = await fetch(
                    `/api/v1/documents/contracts/${contractId}/supplementary-agreements/${this.previewAgreementId}/preview`
                );
                const data = await resp.json();
                this.previewRows = data.data || [];
            } catch (e) {
                this.showToast('预览加载失败', 'error');
            } finally {
                this.isLoadingPreview = false;
            }
        }
    };
}

window.contractDetailApp = contractDetailApp;
