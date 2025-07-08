import * as vscode from 'vscode';

export class asm6502DocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  public provideDocumentSymbols(
    document: vscode.TextDocument
  ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
    const symbols: vscode.DocumentSymbol[] = [];
    const labelDefs = new Map<string, vscode.DocumentSymbol>();
    const lines = document.getText().split(/\r?\n/);

    let currentGlobalParent: vscode.DocumentSymbol | null = null;
    let currentMacroParent: vscode.DocumentSymbol | null = null;

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber].trim();

      // Match .proc block
      const procMatch = line.match(/^[ \t]*\.proc[ \t]+([A-Za-z_][\w@#]*)/i);
      if (procMatch) {
        const name = procMatch[1];
        const symbol = this.createSymbol(name, lineNumber, vscode.SymbolKind.Function, '.proc');
        symbol.range = new vscode.Range(lineNumber, 0, document.lineCount, 0);
        symbols.push(symbol);
        currentGlobalParent = symbol;
        currentMacroParent = null;
        continue;
      }

      // Match .macro block
      const macroMatch = line.match(/^[ \t]*\.macro[ \t]+([A-Za-z_][\w@#]*)/i);
      if (macroMatch) {
        const name = macroMatch[1];
        const symbol = this.createSymbol(name, lineNumber, vscode.SymbolKind.Function, 'Macro');
        symbol.range = new vscode.Range(lineNumber, 0, document.lineCount, 0);
        symbols.push(symbol);
        currentMacroParent = symbol;
        currentGlobalParent = null;
        continue;
      }

      // End of .proc or .macro
      const endBlockMatch = line.match(/^[ \t]*\.(endproc|endmacro)\b/i);
      if (endBlockMatch) {
        const endLine = lineNumber + 1;
        const current = endBlockMatch[1] === 'endproc' ? currentGlobalParent : currentMacroParent;
        if (current) {
          current.range = new vscode.Range(current.range.start, new vscode.Position(endLine, 0));
        }
        if (endBlockMatch[1] === 'endproc') currentGlobalParent = null;
        if (endBlockMatch[1] === 'endmacro') currentMacroParent = null;
        continue;
      }

      // Match standalone global label
      const globalLabelMatch = line.match(/^[ \t]*([A-Za-z_][\w@#]*):/);
      if (globalLabelMatch) {
        const name = globalLabelMatch[1];
        const symbol = this.createSymbol(name, lineNumber, vscode.SymbolKind.Function, 'Global Label');
        symbol.range = new vscode.Range(lineNumber, 0, lineNumber + 1, 0); // Set range to the line of the label
      
        const parent = currentMacroParent || currentGlobalParent;
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(symbol);
        } else {
          symbols.push(symbol);
        }
      
        labelDefs.set(name, symbol);
        continue;
      }

      // Match local label (.label: or @label:)
      const localLabelMatch = line.match(/^[ \t]*([.@](?!proc|macro|endproc|endmacro)[\w@#]+):/i);
      if (localLabelMatch) {
        const name = localLabelMatch[1];
        const symbol = this.createSymbol(name, lineNumber, vscode.SymbolKind.Variable, 'Local Label');
        symbol.range = new vscode.Range(lineNumber, 0, lineNumber + 1, 0);
        const parent = currentMacroParent || currentGlobalParent;
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(symbol);
        } else {
          symbols.push(symbol);
        }
        continue;
      }
      // Match simple defines/constants (e.g., VAR = $2002)
      const defineRegex = /^\s*([A-Za-z_][\w]*)\s*=\s*([^;]+)/;
      const defineMatch = defineRegex.exec(line);
      if (defineMatch) {
        const name = defineMatch[1];
        const value = defineMatch[2].trim();
        const index = line.indexOf(name);
        // 👇 Merge into name to make it appear in Outline
        const displayName = `${name} = ${value}`;
        const constSymbol = this.createSymbol(displayName, lineNumber, vscode.SymbolKind.Constant, 'Constant');
        constSymbol.range = new vscode.Range(lineNumber, index, lineNumber, index + name.length);
        symbols.push(constSymbol);
        continue;
      }


      // Match common assembler directives (structural, not labels)
      const directiveMatch = line.match(/^[ \t]*\.(A16|A8|ADDR|ALIGN|ASCIIZ|ASSERT|AUTOIMPORT|BANKBYTES|BSS|BYT|BYTE|CASE|CHARMAP|CODE|CONDES|CONSTRUCTOR|DATA|DBT|DEBUGINFO|DEFINE|DELMAC|DELMACRO|DESTRUCTOR|DWORD|ELSE|ELSEIF|END|ENDENUM|ENDIF|ENDMAC|ENDREP|ENDREPEAT|ENDSCOPE|ENDSTRUCT|ENDUNION|ENUM|ERROR|EXITMAC|EXPORT|EXPORTZP|FARADDR|FATAL|FEATURE|FILEOPT|FOPT|FORCEIMPORT|GLOBAL|GLOBALZP|HIBYTES|I16|I8|IF|IFBLANK|IFCONST|IFDEF|IFNBLANK|IFNDEF|IFNREF|IFP02|IFP4510|IFP816|IFPC02|IFPDTV|IFPSC02|IFREF|IMPORT|IMPORTZP|INCBIN|INCLUDE|INTERRUPTOR|LIST|LISTBYTES|LITERAL|LOBYTES|LOCAL|LOCALCHAR|MACPACK|ORG|OUT|P02|P4510|P816|PAGELEN|PAGELENGTH|PC02|PDTV|POPCHARMAP|POPCPU|POPSEG|PSC02|PUSHCHARMAP|PUSHCPU|PUSHSEG|REFERTO|REFTO|RELOC|REPEAT|RES|RODATA|SCOPE|SEGMENT|SET|SETCPU|SMART|STRUCT|TAG|UNDEF|UNDEFINE|UNION|WARNING|WORD|ZEROPAGE)\b\s*(.*)/i);
      if (directiveMatch) {
        const directive = directiveMatch[1];
        const arg = directiveMatch[2].trim();
        const label = `.${directive} ${arg}`;
        const symbol = this.createSymbol(label, lineNumber, vscode.SymbolKind.Interface, 'Directive');
        symbol.range = new vscode.Range(lineNumber, 0, lineNumber + 1, 0);
        symbols.push(symbol);
        continue;
      }

    } // <-- Add this closing brace to end the first for-loop

    // Pass 2: detect label references and nest under defining symbol
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];
      for (const [labelName, parentSymbol] of Array.from(labelDefs.entries())) {
        const refRegex = new RegExp(`\\b${labelName}\\b`);
        if (refRegex.test(line)) {
          if (line.trim().startsWith(labelName + ':')) continue; // skip the label definition line
          const refSymbol = this.createSymbol(labelName, lineNumber, vscode.SymbolKind.File, 'Global Label Reference');
          refSymbol.range = new vscode.Range(lineNumber, 0, lineNumber + 1, 0);
          if (parentSymbol.children) {
            parentSymbol.children.push(refSymbol);
          } else {
            parentSymbol.children = [refSymbol];
          }
        }
      }
    }

    // Pass 3: detect local label references and nest under defining symbol
    // To avoid mutating the array while iterating, collect new refs first
    const createSymbol = this.createSymbol.bind(this);
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];
      // Loop over symbols to find locals (starting with '.' or '@')
      for (const parent of symbols) {
        if (!parent.children)
          continue;
        // Collect new references to add after iteration
        const newRefs = [];
        for (const child of parent.children) {
          if (!child.name.startsWith('.') && !child.name.startsWith('@'))
            continue;
          const labelMatch = line.includes(child.name);
          const isDefinition = line.trim().startsWith(child.name + ':');
          if (labelMatch && !isDefinition) {
            const index = line.indexOf(child.name);
            const refSymbol = createSymbol(child.name, lineNumber, vscode.SymbolKind.Property, 'Local Label Reference');
            refSymbol.range = new vscode.Range(lineNumber, index, lineNumber, index + child.name.length);
            newRefs.push(refSymbol);
          }
        }
        // Add all new references after the loop
        if (newRefs.length > 0) {
          parent.children.push(...newRefs);
        }
      }
    }

    return symbols;
  }

  private createSymbol(
    name: string,
    line: number,
    kind: vscode.SymbolKind,
    detail = ''
  ): vscode.DocumentSymbol {
    const range = new vscode.Range(line, 0, line, 1000);
    return new vscode.DocumentSymbol(name, detail, kind, range, range);
  }
}

export {};
