(function () {
    function updateCaseOptions(contractSelect, caseSelect) {
        if (!contractSelect || !caseSelect) {
            return;
        }

        const contractId = contractSelect.value || "";
        const options = Array.from(caseSelect.options);
        const blankOption = options.find((option) => option.value === "");
        const caseOptions = options.filter((option) => option.value !== "");

        let visibleOptions = [];
        for (const option of caseOptions) {
            const matches = contractId && option.dataset.contractId === contractId;
            option.hidden = !matches;
            option.disabled = !matches;
            if (matches) {
                visibleOptions.push(option);
            }
        }

        if (!contractId) {
            caseSelect.value = "";
            caseSelect.disabled = true;
            if (blankOption) {
                blankOption.textContent = "请先选择合同";
            }
            return;
        }

        if (visibleOptions.length === 0) {
            caseSelect.value = "";
            caseSelect.disabled = true;
            if (blankOption) {
                blankOption.textContent = "当前合同暂无案件";
            }
            return;
        }

        caseSelect.disabled = false;
        if (blankOption) {
            blankOption.textContent = visibleOptions.length === 1 ? "将自动带入唯一案件" : "请选择具体案件";
        }

        const currentOption = caseSelect.selectedOptions[0];
        const currentValid = currentOption && currentOption.value !== "" && !currentOption.hidden && !currentOption.disabled;
        if (currentValid) {
            return;
        }

        caseSelect.value = visibleOptions.length === 1 ? visibleOptions[0].value : "";
    }

    document.addEventListener("DOMContentLoaded", function () {
        const contractSelect = document.getElementById("id_contract");
        const caseSelect = document.getElementById("id_case");
        if (!contractSelect || !caseSelect) {
            return;
        }

        const refresh = function () {
            updateCaseOptions(contractSelect, caseSelect);
        };

        contractSelect.addEventListener("change", refresh);
        refresh();
    });
})();
