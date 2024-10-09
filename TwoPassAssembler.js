document.getElementById("runButton").addEventListener("click", function(e) {
    e.preventDefault();

    const inputFile = document.getElementById("inputFile").files[0];
    const optabFile = document.getElementById("optabFile").files[0];

    if (!inputFile || !optabFile) {
        alert("Please upload both input and optab files.");
        return;
    }

    if (!validateFileExtension(inputFile) || !validateFileExtension(optabFile)) {
        alert("Invalid file type. Please upload valid .txt files only.");
        document.getElementById("inputFile").value = '';
        document.getElementById("optabFile").value = '';
        return;
    }

    const reader1 = new FileReader();
    const reader2 = new FileReader();

    reader1.onload = function(e) {
        const inputContent = e.target.result;
        reader2.readAsText(optabFile);

        reader2.onload = function(e) {
            const optabContent = e.target.result;
            processAssembler(inputContent, optabContent);
        };
    };

    reader1.readAsText(inputFile);
});

function validateFileExtension(file) {
    const allowedExtension = /\.txt$/i;
    return allowedExtension.test(file.name);
}

function processAssembler(inputContent, optabContent) {
    const inputLines = inputContent.split("\n");
    const optabLines = optabContent.split("\n");

    let OPTAB = {};
    optabLines.forEach(line => {
        const [opcode, machineCode] = line.split(/\s+/);
        OPTAB[opcode] = machineCode;
    });

    let SYMTAB = {};
    let LOCCTR = 0;
    let intermediateContent = "";
    let symtabContent = "";
    let startAddress = 0;
    let programName = "";
    let programLength = 0;

    inputLines.forEach((line, index) => {
        const [label = '', opcode = '', operand = ''] = line.split(/\s+/);

        if (opcode === "START") {
            startAddress = parseInt(operand, 16);
            LOCCTR = startAddress;
            programName = label;
            intermediateContent += `\t${line}\n`;
        } else if (opcode === "END") {
            intermediateContent += `${LOCCTR.toString(16)}\t${line}\n`;
            programLength = LOCCTR - startAddress;
        } else {
            intermediateContent += `${LOCCTR.toString(16).padStart(4, '0')}\t${line}\n`;

            if (label && label !== "-") {
                if (SYMTAB[label]) {
                    alert(`Error: Symbol ${label} already exists in SYMTAB.`);
                } else {
                    SYMTAB[label] = LOCCTR;
                    symtabContent += `${label}\t${LOCCTR.toString(16).padStart(4, '0')}\n`;
                }
            }

            if (OPTAB[opcode]) {
                LOCCTR += 3;
            } else if (opcode === "WORD") {
                LOCCTR += 3;
            } else if (opcode === "RESW") {
                LOCCTR += 3 * parseInt(operand);
            } else if (opcode === "RESB") {
                LOCCTR += parseInt(operand);
            } else if (opcode === "BYTE") {
                LOCCTR += operand.length - 3;
            }
        }
    });

    let objectCodeContent = "";
    let outputContent = "";
    let intermediateLines = intermediateContent.split("\n");
    LOCCTR = startAddress;

    let headerRecord = `H^${programName.padEnd(6)}^${startAddress.toString(16).padStart(6, '0')}^${programLength.toString(16).padStart(6, '0')}\n`;
    let textRecord = "";
    let textStartAddress = LOCCTR.toString(16).padStart(6, "0");
    let textRecordBuffer = [];
    let textRecordLength = 0;

    intermediateLines.forEach((intermediateLine, index) => {
        const lineParts = intermediateLine.split("\t");
        const currentLOCCTR = lineParts[0];
        const originalLine = lineParts.slice(1).join("\t").trim();
        const [label = '', opcode = '', operand = ''] = originalLine.split(/\s+/);

        if (opcode === "START") {
            outputContent += `\t${originalLine}\n`;
        } else if (OPTAB[opcode]) {
            let objCode = OPTAB[opcode];
            let address = "0000";

            if (operand && SYMTAB[operand]) {
                address = SYMTAB[operand].toString(16).padStart(4, "0");
            }

            let fullObjectCode = `${objCode}${address}`;
            textRecordBuffer.push(fullObjectCode);
            textRecordLength += 3;

            objectCodeContent += `${currentLOCCTR}\t${fullObjectCode}\n`;
            outputContent += `${currentLOCCTR}\t${originalLine}\t${fullObjectCode}\n`;

            if (textRecordLength >= 30) {
                textRecord += `T^${textStartAddress}^${textRecordLength.toString(16).padStart(2, '0')}^${textRecordBuffer.join('^')}\n`;
                textStartAddress = LOCCTR.toString(16).padStart(6, "0");
                textRecordBuffer = [];
                textRecordLength = 0;
            }
        } else if (opcode === "WORD") {
            const wordValue = parseInt(operand).toString(16).padStart(6, "0");
            textRecordBuffer.push(wordValue);
            textRecordLength += 3;

            objectCodeContent += `${currentLOCCTR}\t${wordValue}\n`;
            outputContent += `${currentLOCCTR}\t${originalLine}\t${wordValue}\n`;
        } else if (opcode === "BYTE") {
            let byteValue = operand.substring(2, operand.length - 1);
            if (operand.startsWith("C'")) {
                byteValue = byteValue.split("").map(char => char.charCodeAt(0).toString(16)).join("");
            } else if (operand.startsWith("X'")) {
                byteValue = byteValue.toUpperCase();
            }
            textRecordBuffer.push(byteValue);
            textRecordLength += byteValue.length / 2;

            objectCodeContent += `${currentLOCCTR}\t${byteValue}\n`;
            outputContent += `${currentLOCCTR}\t${originalLine}\t${byteValue}\n`;
        } else if (opcode === "RESW" || opcode === "RESB") {
            outputContent += `${currentLOCCTR}\t${originalLine}\n`;
        }

        if (opcode === "END") {
            if (textRecordBuffer.length > 0) {
                textRecord += `T^${textStartAddress}^${textRecordLength.toString(16).padStart(2, '0')}^${textRecordBuffer.join('^')}\n`;
            }
            outputContent += `${currentLOCCTR}\t${originalLine}\n`;
        }
    });

    let endRecord = `E^${startAddress.toString(16).padStart(6, '0')}\n`;
    objectCodeContent = headerRecord + textRecord + endRecord;

    document.getElementById("intermediateOutput").value = intermediateContent;
    document.getElementById("symtabOutput").value = symtabContent;
    document.getElementById("output").value = outputContent;
    document.getElementById("objectCode").value = objectCodeContent;
    document.getElementById("programLengthOutput").value = "The length of the program is: " + programLength.toString(16).padStart(4, '0');
}

function downloadFile(textareaId, filename) {
    const textarea = document.getElementById(textareaId);
    const text = textarea.value;

    const blob = new Blob([text], {
        type: 'text/plain'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.getElementById("runButton").addEventListener("click", function(e) {
    e.preventDefault();

    const inputFile = document.getElementById("inputFile").files[0];
    const optabFile = document.getElementById("optabFile").files[0];

    if (inputFile && optabFile) {
        const reader1 = new FileReader();
        const reader2 = new FileReader();

        reader1.onload = function(e) {
            const inputContent = e.target.result;
            reader2.readAsText(optabFile);

            reader2.onload = function(e) {
                const optabContent = e.target.result;
                processAssembler(inputContent, optabContent);
            };
        };

        reader1.readAsText(inputFile);
    } else {
        alert("Please upload both input and optab files.");
    }
});