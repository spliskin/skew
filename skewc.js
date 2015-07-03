(function() {
  function __extends(derived, base) {
    derived.prototype = Object.create(base.prototype);
    derived.prototype.constructor = derived;
  }

  var __imul = Math.imul ? Math.imul : function(a, b) {
    var ah = a >> 16 & 65535;
    var bh = b >> 16 & 65535;
    var al = a & 65535;
    var bl = b & 65535;
    return al * bl + (ah * bl + al * bh << 16) | 0;
  };

  function assert(truth) {
    if (!truth) {
      throw Error("Assertion failed");
    }
  }

  function StringBuilder() {
    var self = this;
    self.buffer = "";
  }

  StringBuilder.prototype.append = function(x) {
    var self = this;
    self.buffer += x;
  };

  StringBuilder.prototype.toString = function() {
    var self = this;
    return self.buffer;
  };

  function Box(value) {
    var self = this;
    self.value = value;
  }

  var Skew = {};

  Skew.quoteString = function(text, quote) {
    var builder = new StringBuilder();
    var quoteString = String.fromCharCode(quote);
    var escaped = "";

    // Append long runs of unescaped characters using a single slice for speed
    var start = 0;
    builder.append(quoteString);

    for (var i = 0, count = text.length; i < count; ++i) {
      var c = text.charCodeAt(i);

      if (c === quote) {
        escaped = "\\" + quoteString;
      }

      else if (c === 10) {
        escaped = "\\n";
      }

      else if (c === 13) {
        escaped = "\\r";
      }

      else if (c === 9) {
        escaped = "\\t";
      }

      else if (c === 0) {
        escaped = "\\0";
      }

      else if (c === 92) {
        escaped = "\\\\";
      }

      else if (c < 32) {
        escaped = "\\x" + Skew.HEX[c >> 4] + Skew.HEX[c & 15];
      }

      else {
        continue;
      }

      builder.append(text.slice(start, i));
      builder.append(escaped);
      start = i + 1 | 0;
    }

    builder.append(text.slice(start, text.length));
    builder.append(quoteString);
    return builder.toString();
  };

  Skew.argumentCountForOperator = function(text) {
    if (Skew.argumentCounts === null) {
      Skew.argumentCounts = Object.create(null);

      for (var i = 0, list = in_IntMap.values(Skew.operatorInfo), count = list.length; i < count; ++i) {
        var value = list[i];
        Skew.argumentCounts[value.text] = value.count;
      }

      Skew.argumentCounts["[...]"] = Skew.ArgumentCount.ONE;
      Skew.argumentCounts["[new]"] = Skew.ArgumentCount.ZERO_OR_ONE;
      Skew.argumentCounts["{...}"] = Skew.ArgumentCount.ONE_OR_TWO;
      Skew.argumentCounts["{new}"] = Skew.ArgumentCount.TWO_OR_FEWER;
    }

    return in_StringMap.get(Skew.argumentCounts, text, Skew.ArgumentCount.ZERO_OR_MORE);
  };

  Skew.hashCombine = function(left, right) {
    return left ^ ((right - 1640531527 | 0) + (left << 6) | 0) + (left >> 2);
  };

  // This is the inner loop from "flex", an ancient lexer generator. The output
  // of flex is pretty bad (obfuscated variable names and the opposite of modular
  // code) but it's fast and somewhat standard for compiler design. The code below
  // replaces a simple hand-coded lexer and offers much better performance.
  Skew.tokenize = function(log, source) {
    var tokens = [];
    var text = source.contents;
    var text_length = text.length;

    // For backing up
    var yy_last_accepting_state = 0;
    var yy_last_accepting_cpos = 0;

    // The current character pointer
    var yy_cp = 0;

    while (yy_cp < text_length) {
      // Reset the NFA
      var yy_current_state = 1;

      // The pointer to the beginning of the token
      var yy_bp = yy_cp;

      // Search for a match
      while (yy_current_state !== 225) {
        if (yy_cp >= text_length) {
          // This prevents syntax errors from causing infinite loops
          break;
        }

        var c = text.charCodeAt(yy_cp);
        var index = c < 127 ? c : 127;
        var yy_c = Skew.yy_ec[index];

        if (Skew.yy_accept[yy_current_state] !== Skew.TokenKind.YY_INVALID_ACTION) {
          yy_last_accepting_state = yy_current_state;
          yy_last_accepting_cpos = yy_cp;
        }

        while (Skew.yy_chk[Skew.yy_base[yy_current_state] + yy_c | 0] !== yy_current_state) {
          yy_current_state = Skew.yy_def[yy_current_state];

          if (yy_current_state >= 226) {
            yy_c = Skew.yy_meta[yy_c];
          }
        }

        yy_current_state = Skew.yy_nxt[Skew.yy_base[yy_current_state] + yy_c | 0];
        ++yy_cp;
      }

      // Find the action
      var yy_act = Skew.yy_accept[yy_current_state];

      while (yy_act === Skew.TokenKind.YY_INVALID_ACTION) {
        // Have to back up
        yy_cp = yy_last_accepting_cpos;
        yy_current_state = yy_last_accepting_state;
        yy_act = Skew.yy_accept[yy_current_state];
      }

      // Ignore whitespace
      if (yy_act === Skew.TokenKind.WHITESPACE) {
        continue;
      }

      // This is the default action in flex, which is usually called ECHO
      else if (yy_act === Skew.TokenKind.ERROR) {
        var iterator = Unicode.StringIterator.INSTANCE.reset(text, yy_bp);
        iterator.nextCodePoint();
        var range = new Skew.Range(source, yy_bp, iterator.index);
        log.syntaxErrorExtraData(range, range.toString());
        break;
      }

      // Ignore END_OF_FILE since this loop must still perform the last action
      else if (yy_act !== Skew.TokenKind.END_OF_FILE) {
        tokens.push(new Skew.Token(new Skew.Range(source, yy_bp, yy_cp), yy_act));

        // These tokens start with a ">" and may need to be split if we discover
        // that they should really be END_PARAMETER_LIST tokens. Save enough room
        // for these tokens to be split into pieces, that way all of the tokens
        // don't have to be shifted over repeatedly inside prepareTokens(). The
        // ">>" token may become ">" + ">", the ">=" token may become ">" + "=",
        // and the ">>=" token may become ">" + ">=" and so ">" + ">" + "=".
        if (yy_act === Skew.TokenKind.ASSIGN_SHIFT_RIGHT || yy_act === Skew.TokenKind.SHIFT_RIGHT || yy_act === Skew.TokenKind.GREATER_THAN_OR_EQUAL) {
          tokens.push(null);

          if (yy_act === Skew.TokenKind.ASSIGN_SHIFT_RIGHT) {
            tokens.push(null);
          }
        }
      }
    }

    // Every token stream ends in END_OF_FILE
    tokens.push(new Skew.Token(new Skew.Range(source, text_length, text_length), Skew.TokenKind.END_OF_FILE));

    // Also return preprocessor token presence so the preprocessor can be avoided
    return tokens;
  };

  Skew.parseFile = function(log, tokens, global) {
    var context = new Skew.ParserContext(log, tokens);
    Skew.Parsing.parseSymbols(context, global, null);
    context.expect(Skew.TokenKind.END_OF_FILE);
  };

  Skew.prepareTokens = function(tokens) {
    var previousKind = Skew.TokenKind.NULL;
    var stack = [];
    var count = 0;

    for (var i = 0, count1 = tokens.length; i < count1; ++i) {
      var token = tokens[i];

      // Skip null placeholders after tokens that start with a greater than. Each
      // token that may need to split has enough nulls after it for all the pieces.
      // It's a lot faster to remove null gaps during token preparation than to
      // insert pieces in the middle of the token stream (O(n) vs O(n^2)).
      if (token === null) {
        continue;
      }

      // Compress tokens to eliminate unused null gaps
      tokens[count] = token;
      ++count;

      // Tokens that start with a greater than may need to be split
      var tokenKind = token.kind;
      var tokenStartsWithGreaterThan = token.firstCodeUnit() === 62;

      // Remove tokens from the stack if they aren't working out
      while (!(stack.length === 0)) {
        var top = in_List.last(stack);
        var topKind = top.kind;

        // Stop parsing a type if we find a token that no type expression uses
        if (topKind === Skew.TokenKind.LESS_THAN && tokenKind !== Skew.TokenKind.LESS_THAN && tokenKind !== Skew.TokenKind.IDENTIFIER && tokenKind !== Skew.TokenKind.COMMA && tokenKind !== Skew.TokenKind.DOT && tokenKind !== Skew.TokenKind.LEFT_PARENTHESIS && tokenKind !== Skew.TokenKind.RIGHT_PARENTHESIS && !tokenStartsWithGreaterThan) {
          stack.pop();
        }

        else {
          break;
        }
      }

      // Group open
      if (tokenKind === Skew.TokenKind.LEFT_PARENTHESIS || tokenKind === Skew.TokenKind.LEFT_BRACE || tokenKind === Skew.TokenKind.LEFT_BRACKET || tokenKind === Skew.TokenKind.LESS_THAN) {
        stack.push(token);
      }

      // Group close
      else if (tokenKind === Skew.TokenKind.RIGHT_PARENTHESIS || tokenKind === Skew.TokenKind.RIGHT_BRACE || tokenKind === Skew.TokenKind.RIGHT_BRACKET || tokenStartsWithGreaterThan) {
        // Search for a matching opposite token
        while (!(stack.length === 0)) {
          var top1 = in_List.last(stack);
          var topKind1 = top1.kind;

          // Don't match closing angle brackets that don't work since they are just operators
          if (tokenStartsWithGreaterThan && topKind1 !== Skew.TokenKind.LESS_THAN) {
            break;
          }

          // Consume the current token
          stack.pop();

          // Special-case angle brackets matches
          if (topKind1 === Skew.TokenKind.LESS_THAN) {
            // Remove tentative matches that didn't work out
            if (!tokenStartsWithGreaterThan) {
              continue;
            }

            // Break apart operators that start with a closing angle bracket
            if (tokenKind !== Skew.TokenKind.GREATER_THAN) {
              var range = token.range;
              var start = range.start;
              assert((i + 1 | 0) < tokens.length);
              assert(tokens[i + 1 | 0] === null);
              assert(tokenKind === Skew.TokenKind.SHIFT_RIGHT || tokenKind === Skew.TokenKind.GREATER_THAN_OR_EQUAL || tokenKind === Skew.TokenKind.ASSIGN_SHIFT_RIGHT);
              tokens[i + 1 | 0] = new Skew.Token(new Skew.Range(range.source, start + 1 | 0, range.end), tokenKind === Skew.TokenKind.SHIFT_RIGHT ? Skew.TokenKind.GREATER_THAN : tokenKind === Skew.TokenKind.GREATER_THAN_OR_EQUAL ? Skew.TokenKind.ASSIGN : Skew.TokenKind.GREATER_THAN_OR_EQUAL);
              token.range = new Skew.Range(range.source, start, start + 1 | 0);
            }

            // Convert < and > into bounds for type parameter lists
            top1.kind = Skew.TokenKind.START_PARAMETER_LIST;
            token.kind = Skew.TokenKind.END_PARAMETER_LIST;
            tokenKind = Skew.TokenKind.END_PARAMETER_LIST;
          }

          // Stop the search since we found a match
          break;
        }
      }

      // Remove newlines based on the previous token or the next token to enable
      // line continuations. Make sure to be conservative. We want to be like
      // Python, not like JavaScript ASI! Anything that is at all ambiguous
      // should be disallowed.
      if (tokenKind === Skew.TokenKind.NEWLINE && previousKind in Skew.REMOVE_NEWLINE_AFTER && !(tokens[i + 1 | 0].kind in Skew.KEEP_NEWLINE_BEFORE)) {
        --count;
        continue;
      }

      else if (previousKind === Skew.TokenKind.NEWLINE && tokenKind in Skew.REMOVE_NEWLINE_BEFORE) {
        tokens[count - 2 | 0] = token;
        --count;
      }

      previousKind = tokenKind;
    }

    // Trim off the remaining tokens due to null gap removal
    while (tokens.length > count) {
      tokens.pop();
    }
  };

  Skew.compile = function(log, options, sources) {
    var start = (typeof(performance) !== "undefined" && performance.now ? performance.now() : Date.now()) / 1000;
    var debug = !RELEASE;
    var result = new Skew.CompilerResult();

    switch (options.target) {
      case Skew.CompilerTarget.JAVASCRIPT: {
        sources.unshift(new Skew.Source("<native-js>", Skew.NATIVE_LIBRARY_JS));
        options.define("TARGET", "JAVASCRIPT");
        break;
      }
    }

    sources.unshift(new Skew.Source("<native>", Skew.NATIVE_LIBRARY));

    for (var i = 0, list = sources, count = list.length; i < count; ++i) {
      var source = list[i];
      var tokens = Skew.tokenize(log, source);
      Skew.prepareTokens(tokens);
      Skew.parseFile(log, tokens, result.global);
    }

    // Merging pass, errors stop compilation
    if (!log.hasErrors()) {
      Skew.mergingPass(log, result.global);

      // Resolving pass, errors stop compilation
      if (!log.hasErrors()) {
        Skew.resolvingPass(log, result.global, result.cache, options);

        if (debug) {
          Skew.verifyHierarchy1(result.global);
        }

        // Prepare for emission, code is error-free at this point
        if (!log.hasErrors() && options.target !== Skew.CompilerTarget.NONE) {
          if (!(options.target === Skew.CompilerTarget.LISP_TREE)) {
            var graph = new Skew.CallGraph(result.global);

            // Make certain functions global
            Skew.globalizingPass(result.global, graph, options);

            if (debug) {
              Skew.verifyHierarchy1(result.global);
            }

            // Move symbols around
            Skew.motionPass(result.global, graph);

            if (debug) {
              Skew.verifyHierarchy1(result.global);
            }

            // Give overloaded functions unique names, rename operator overloads
            Skew.renamingPass(result.global);

            if (debug) {
              Skew.verifyHierarchy1(result.global);
            }

            // Partial evaluation before inlining to make more functions inlineable by removing dead code
            if (options.foldAllConstants) {
              new Skew.Folding.ConstantFolder(result.cache, new Skew.Folding.ConstantCache()).visitObject(result.global);

              if (debug) {
                Skew.verifyHierarchy1(result.global);
              }
            }

            // Function inlining
            if (options.inlineAllFunctions) {
              Skew.inliningPass(graph);

              if (debug) {
                Skew.verifyHierarchy1(result.global);
              }

              // Partial evaluation after inlining will simplify inlined expressions
              if (options.foldAllConstants) {
                new Skew.Folding.ConstantFolder(result.cache, new Skew.Folding.ConstantCache()).visitObject(result.global);

                if (debug) {
                  Skew.verifyHierarchy1(result.global);
                }
              }
            }
          }

          // Emit in the target language
          var emitter = null;

          switch (options.target) {
            case Skew.CompilerTarget.JAVASCRIPT: {
              emitter = new Skew.JsEmitter(options, result.cache);
              break;
            }

            case Skew.CompilerTarget.LISP_TREE: {
              emitter = new Skew.LispTreeEmitter(options);
              break;
            }
          }

          if (emitter !== null) {
            emitter.visit(result.global);
            result.outputs = emitter.sources();
          }
        }
      }
    }

    result.totalTime = (typeof(performance) !== "undefined" && performance.now ? performance.now() : Date.now()) / 1000 - start;
    return result;
  };

  Skew.verifyHierarchy1 = function(symbol) {
    for (var i = 0, list = symbol.objects, count = list.length; i < count; ++i) {
      var object = list[i];
      Skew.verifyHierarchy1(object);
    }

    for (var i1 = 0, list1 = symbol.functions, count1 = list1.length; i1 < count1; ++i1) {
      var $function = list1[i1];
      Skew.verifyHierarchy2($function.block, null);
    }

    for (var i2 = 0, list2 = symbol.variables, count2 = list2.length; i2 < count2; ++i2) {
      var variable = list2[i2];
      Skew.verifyHierarchy2(variable.value, null);
    }
  };

  Skew.verifyHierarchy2 = function(node, parent) {
    if (node !== null) {
      assert(node.parent === parent);

      if (node.children !== null) {
        for (var i = 0, list = node.children, count = list.length; i < count; ++i) {
          var child = list[i];
          Skew.verifyHierarchy2(child, node);
        }
      }
    }
  };

  Skew.globalizingPass = function(global, graph, options) {
    var virtualLookup = options.globalizeAllFunctions ? new Skew.VirtualLookup(global) : null;

    for (var i1 = 0, list1 = graph.callInfo, count1 = list1.length; i1 < count1; ++i1) {
      var info = list1[i1];
      var symbol = info.symbol;

      // Turn certain instance functions into global functions
      if (symbol.kind === Skew.SymbolKind.FUNCTION_INSTANCE && (symbol.parent.kind === Skew.SymbolKind.OBJECT_ENUM || symbol.parent.isImported() && !symbol.isImported() || !symbol.isImportedOrExported() && virtualLookup !== null && !virtualLookup.isVirtual(symbol))) {
        var $function = symbol.asFunctionSymbol();
        $function.kind = Skew.SymbolKind.FUNCTION_GLOBAL;
        $function.$arguments.unshift($function.self);
        $function.self = null;

        // Update all call sites
        for (var i = 0, list = info.callSites, count = list.length; i < count; ++i) {
          var callSite = list[i];
          var value = callSite.callNode.callValue();

          // Rewrite "super(foo)" to "bar(self, foo)"
          if (value.kind === Skew.NodeKind.SUPER) {
            var self = callSite.enclosingFunction.self;
            value.replaceWith(new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent(self.name)).withSymbol(self));
          }

          // Rewrite "self.foo(bar)" to "foo(self, bar)"
          else {
            value.dotTarget().swapWith(value);
          }

          callSite.callNode.insertChild(0, new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent($function.name)).withSymbol($function));
        }
      }
    }
  };

  Skew.inliningPass = function(callGraph) {
    var graph = new Skew.Inlining.InliningGraph(callGraph);

    for (var i = 0, list = graph.inliningInfo, count = list.length; i < count; ++i) {
      var info = list[i];
      Skew.Inlining.inlineSymbol(graph, info);
    }
  };

  Skew.mergingPass = function(log, global) {
    Skew.Merging.mergeObject(log, null, global, global);
  };

  Skew.motionPass = function(global, graph) {
    var parents = Object.create(null);

    for (var i = 0, list = graph.callInfo, count = list.length; i < count; ++i) {
      var info = list[i];
      var symbol = info.symbol;

      // Move global functions with implementations off imported objects
      if (symbol.kind === Skew.SymbolKind.FUNCTION_GLOBAL && symbol.parent.isImported() && !symbol.isImported()) {
        var $function = symbol.asFunctionSymbol();
        var parent = in_IntMap.get(parents, $function.parent.id, null);

        // Create a parallel namespace next to the parent
        if (parent === null) {
          var common = $function.parent.parent.asObjectSymbol();
          parent = new Skew.ObjectSymbol(Skew.SymbolKind.OBJECT_NAMESPACE, "in_" + $function.parent.name);
          parent.scope = new Skew.ObjectScope(common.scope, parent);
          parent.parent = common;
          common.objects.push(parent);
          parents[$function.parent.id] = parent;
        }

        // Move this function into that parallel namespace
        in_List.removeOne($function.parent.asObjectSymbol().functions, $function);
        parent.functions.push($function);
        $function.parent = parent;
      }
    }
  };

  Skew.renamingPass = function(global) {
    Skew.Renaming.renameObject(global);

    // Use a second pass to avoid ordering issues
    Skew.Renaming.useOverriddenNames(global);
  };

  Skew.resolvingPass = function(log, global, cache, options) {
    cache.loadGlobals(log, global);

    if (!log.hasErrors()) {
      var resolver = new Skew.Resolving.Resolver(global, options, in_StringMap.clone(options.defines), cache, log);
      resolver.constantFolder = new Skew.Folding.ConstantFolder(cache, new Skew.Resolving.ConstantResolver(resolver));
      resolver.initializeGlobals();
      resolver.iterativelyMergeGuards();
      resolver.resolveGlobal();
      resolver.removeObsoleteFunctions(global);
    }
  };

  // Remove all code that isn't reachable from the entry point or from an
  // imported or exported symbol. This is called tree shaking here but is also
  // known as dead code elimination. Tree shaking is perhaps a better name
  // because this pass doesn't remove dead code inside functions.
  Skew.shakingPass = function(global, entryPoint, mode) {
    var graph = new Skew.UsageGraph(global, mode);
    var symbols = [];
    Skew.Shaking.collectImportedOrExportedSymbols(global, symbols, entryPoint);
    var usages = graph.usagesForSymbols(symbols);

    if (usages !== null) {
      Skew.Shaking.removeUnusedSymbols(global, usages);
    }
  };

  Skew.main = function($arguments) {
    // Translate frontend flags to compiler options
    var log = new Skew.Log();
    var parser = new Skew.Options.Parser();
    var options = Skew.parseOptions(log, parser, $arguments);
    var inputs = Skew.readSources(log, parser.normalArguments);

    // Run the compilation
    if (!log.hasErrors() && options !== null) {
      options.target = Skew.CompilerTarget.JAVASCRIPT;
      var result = Skew.compile(log, options, inputs);

      // Write all outputs
      if (!log.hasErrors()) {
        for (var i = 0, list = result.outputs, count = list.length; i < count; ++i) {
          var output = list[i];

          if (!IO.writeFile(output.name, output.contents)) {
            var outputFile = parser.rangeForOption(Skew.Option.OUTPUT_FILE);
            var outputDirectory = parser.rangeForOption(Skew.Option.OUTPUT_DIRECTORY);
            log.commandLineErrorUnwritableFile(outputFile !== null ? outputFile : outputDirectory, output.name);
            break;
          }
        }
      }
    }

    // Print any errors and warnings
    Skew.printLogWithColor(log, parser.intForOption(Skew.Option.MESSAGE_LIMIT, Skew.DEFAULT_MESSAGE_LIMIT));
    return log.hasErrors() ? 1 : 0;
  };

  Skew.printWithColor = function(color, text) {
    Terminal.setColor(color);
    process.stdout.write(text);
    Terminal.setColor(Terminal.Color.DEFAULT);
  };

  Skew.printError = function(text) {
    Skew.printWithColor(Terminal.Color.RED, "error: ");
    Skew.printWithColor(Terminal.Color.BOLD, text + "\n");
  };

  Skew.printNote = function(text) {
    Skew.printWithColor(Terminal.Color.GRAY, "note: ");
    Skew.printWithColor(Terminal.Color.BOLD, text + "\n");
  };

  Skew.printWarning = function(text) {
    Skew.printWithColor(Terminal.Color.MAGENTA, "warning: ");
    Skew.printWithColor(Terminal.Color.BOLD, text + "\n");
  };

  Skew.printUsage = function(parser) {
    Skew.printWithColor(Terminal.Color.GREEN, "\nusage: ");
    Skew.printWithColor(Terminal.Color.BOLD, "skewc [flags] [inputs]\n");
    process.stdout.write(parser.usageText(Math.min(process.stdout.columns, 80)));
  };

  Skew.printLogWithColor = function(log, diagnosticLimit) {
    var terminalWidth = process.stdout.columns;
    var diagnosticCount = 0;

    for (var i = 0, list = log.diagnostics, count = list.length; i < count; ++i) {
      var diagnostic = list[i];

      if (diagnosticLimit > 0 && diagnosticCount === diagnosticLimit) {
        break;
      }

      if (diagnostic.range !== null) {
        Skew.printWithColor(Terminal.Color.BOLD, diagnostic.range.locationString() + ": ");
      }

      switch (diagnostic.kind) {
        case Skew.DiagnosticKind.WARNING: {
          Skew.printWarning(diagnostic.text);
          break;
        }

        case Skew.DiagnosticKind.ERROR: {
          Skew.printError(diagnostic.text);
          break;
        }
      }

      if (diagnostic.range !== null) {
        var formatted = diagnostic.range.format(terminalWidth);
        process.stdout.write(formatted.line + "\n");
        Skew.printWithColor(Terminal.Color.GREEN, formatted.range + "\n");
      }

      if (diagnostic.noteRange !== null) {
        Skew.printWithColor(Terminal.Color.BOLD, diagnostic.noteRange.locationString() + ": ");
        Skew.printNote(diagnostic.noteText);
        var formatted1 = diagnostic.noteRange.format(terminalWidth);
        process.stdout.write(formatted1.line + "\n");
        Skew.printWithColor(Terminal.Color.GREEN, formatted1.range + "\n");
      }

      ++diagnosticCount;
    }

    // Print the summary
    var hasErrors = log.hasErrors();
    var hasWarnings = log.hasWarnings();
    var summary = "";

    if (hasWarnings) {
      summary += log.warningCount.toString() + " warning" + (log.warningCount === 1 ? "" : "s");

      if (hasErrors) {
        summary += " and ";
      }
    }

    if (hasErrors) {
      summary += log.errorCount.toString() + " error" + (log.errorCount === 1 ? "" : "s");
    }

    if (hasWarnings || hasErrors) {
      process.stdout.write(summary + " generated");
      Skew.printWithColor(Terminal.Color.GRAY, diagnosticCount < log.diagnostics.length ? " (only showing " + diagnosticLimit.toString() + " message" + (diagnosticLimit === 1 ? "" : "s") + ", use \"--message-limit=0\" to see all)\n" : "\n");
    }
  };

  Skew.readSources = function(log, files) {
    var result = [];

    for (var i = 0, list = files, count = list.length; i < count; ++i) {
      var file = list[i];
      var path = file.toString();
      var contents = IO.readFile(path);

      if (contents === null) {
        log.commandLineErrorUnreadableFile(file, path);
      }

      else {
        result.push(new Skew.Source(path, contents.value));
      }
    }

    return result;
  };

  Skew.parseOptions = function(log, parser, $arguments) {
    // Configure the parser
    parser.define(Skew.Options.Type.BOOL, Skew.Option.HELP, "--help", "Prints this message.").aliases(["-help", "?", "-?", "-h", "-H", "/?", "/h", "/H"]);
    parser.define(Skew.Options.Type.STRING, Skew.Option.OUTPUT_FILE, "--output-file", "Combines all output into a single file. Mutually exclusive with --output-dir.");
    parser.define(Skew.Options.Type.STRING, Skew.Option.OUTPUT_DIRECTORY, "--output-dir", "Places all output files in the specified directory. Mutually exclusive with --output-file.");
    parser.define(Skew.Options.Type.BOOL, Skew.Option.RELEASE, "--release", "Implies --js-mangle, --js-minify, --fold-constants, --inline-functions, --globalize-functions, and --define:RELEASE=true.");
    parser.define(Skew.Options.Type.INT, Skew.Option.MESSAGE_LIMIT, "--message-limit", "Sets the maximum number of messages to report. Pass 0 to disable the message limit. The default is " + Skew.DEFAULT_MESSAGE_LIMIT.toString() + ".");
    parser.define(Skew.Options.Type.STRING_LIST, Skew.Option.DEFINE, "--define", "Override variable values at compile time.");
    parser.define(Skew.Options.Type.BOOL, Skew.Option.JS_MANGLE, "--js-mangle", "Transforms emitted JavaScript to be as small as possible. The \"@export\" annotation prevents renaming a symbol.");
    parser.define(Skew.Options.Type.BOOL, Skew.Option.JS_MINIFY, "--js-minify", "Remove whitespace when compiling to JavaScript.");
    parser.define(Skew.Options.Type.BOOL, Skew.Option.FOLD_CONSTANTS, "--fold-constants", "Evaluates constants at compile time and removes dead code inside functions.");
    parser.define(Skew.Options.Type.BOOL, Skew.Option.INLINE_FUNCTIONS, "--inline-functions", "Uses heuristics to automatically inline simple global functions.");
    parser.define(Skew.Options.Type.BOOL, Skew.Option.GLOBALIZE_FUNCTIONS, "--globalize-functions", "Convert instance functions to global functions for better inlining.");

    // Parse the command line arguments
    parser.parse(log, $arguments);

    if (log.hasErrors()) {
      return null;
    }

    // Early-out when printing the usage text
    if (parser.boolForOption(Skew.Option.HELP, $arguments.length === 0)) {
      Skew.printUsage(parser);
      return null;
    }

    // Set up the options for the compiler
    var options = new Skew.CompilerOptions();
    var releaseFlag = parser.boolForOption(Skew.Option.RELEASE, false);
    options.foldAllConstants = parser.boolForOption(Skew.Option.FOLD_CONSTANTS, releaseFlag);
    options.globalizeAllFunctions = parser.boolForOption(Skew.Option.GLOBALIZE_FUNCTIONS, releaseFlag);
    options.inlineAllFunctions = parser.boolForOption(Skew.Option.INLINE_FUNCTIONS, releaseFlag);
    options.jsMangle = parser.boolForOption(Skew.Option.JS_MANGLE, releaseFlag);
    options.jsMinify = parser.boolForOption(Skew.Option.JS_MINIFY, releaseFlag);

    // Prepare the defines
    if (releaseFlag) {
      options.define("RELEASE", "true");
    }

    for (var i = 0, list = parser.rangeListForOption(Skew.Option.DEFINE), count = list.length; i < count; ++i) {
      var range = list[i];
      var name = range.toString();
      var equals = name.indexOf("=");

      if (equals < 0) {
        log.commandLineErrorExpectedDefineValue(range, name);
        continue;
      }

      options.defines[name.slice(0, equals)] = new Skew.Define(range.fromStart(equals), range.fromEnd((name.length - equals | 0) - 1 | 0));
    }

    // There must be at least one source file
    var end = parser.source.contents.length;
    var trailingSpace = new Skew.Range(parser.source, end - 1 | 0, end);

    if (parser.normalArguments.length === 0) {
      log.commandLineErrorNoInputFiles(trailingSpace);
    }

    // Parse the output location
    var outputFile = parser.rangeForOption(Skew.Option.OUTPUT_FILE);
    var outputDirectory = parser.rangeForOption(Skew.Option.OUTPUT_DIRECTORY);

    if (outputFile === null && outputDirectory === null) {
      log.commandLineErrorMissingOutput(trailingSpace, "--output-file", "--output-dir");
    }

    else if (outputFile !== null && outputDirectory !== null) {
      log.commandLineErrorDuplicateOutput(outputFile.start > outputDirectory.start ? outputFile : outputDirectory, "--output-file", "--output-dir");
    }

    else if (outputFile !== null) {
      options.outputFile = outputFile.toString();
    }

    else {
      options.outputDirectory = outputDirectory.toString();
    }

    return options;
  };

  Skew.Emitter = function() {
    var self = this;
    self.indentAmount = "  ";
    self.indent = "";
    self._sources = [];
    self._code = "";
  };

  Skew.Emitter.prototype.sources = function() {
    var self = this;
    return self._sources;
  };

  Skew.Emitter.prototype.increaseIndent = function() {
    var self = this;
    self.indent += self.indentAmount;
  };

  Skew.Emitter.prototype.decreaseIndent = function() {
    var self = this;
    self.indent = self.indent.slice(self.indentAmount.length);
  };

  Skew.Emitter.prototype.emit = function(text) {
    var self = this;
    self._code += text;
  };

  Skew.Emitter.prototype.createSource = function(name) {
    var self = this;
    self._sources.push(new Skew.Source(name, self._code));
    self._code = "";
  };

  Skew.Emitter.prototype.sortedObjects = function(global) {
    var self = this;
    var objects = [];
    self.findObjects(objects, global);

    // Sort by inheritance and containment
    for (var i = 0, count = objects.length; i < count; ++i) {
      var j = i;

      // Select an object that comes before all other types
      while (j < objects.length) {
        var object = objects[j];
        var k = i;

        // Check to see if this comes before all other types
        while (k < objects.length) {
          if (j !== k && Skew.Emitter.objectComesBefore(objects[k], object)) {
            break;
          }

          ++k;
        }

        if (k === objects.length) {
          break;
        }

        ++j;
      }

      // Swap the object into the correct order
      if (j < objects.length) {
        in_List.swap(objects, i, j);
      }
    }

    return objects;
  };

  Skew.Emitter.prototype.findObjects = function(objects, object) {
    var self = this;
    objects.push(object);

    for (var i = 0, list = object.objects, count = list.length; i < count; ++i) {
      var o = list[i];
      self.findObjects(objects, o);
    }
  };

  Skew.Emitter.isContainedBy = function(inner, outer) {
    if (inner.parent === null) {
      return false;
    }

    if (inner.parent === outer) {
      return true;
    }

    return Skew.Emitter.isContainedBy(inner.parent.asObjectSymbol(), outer);
  };

  Skew.Emitter.objectComesBefore = function(before, after) {
    if (after.hasBaseClass(before)) {
      return true;
    }

    if (Skew.Emitter.isContainedBy(after, before)) {
      return true;
    }

    return false;
  };

  Skew.Associativity = {
    NONE: 0,
    LEFT: 1,
    RIGHT: 2
  };

  // The same operator precedence as C for the most part
  Skew.Precedence = {
    LOWEST: 0,
    COMMA: 1,
    ASSIGN: 2,
    LOGICAL_OR: 3,
    LOGICAL_AND: 4,
    BITWISE_OR: 5,
    BITWISE_XOR: 6,
    BITWISE_AND: 7,
    EQUAL: 8,
    COMPARE: 9,
    SHIFT: 10,
    ADD: 11,
    MULTIPLY: 12,
    UNARY_PREFIX: 13,
    UNARY_POSTFIX: 14,
    MEMBER: 15
  };

  Skew.BooleanSwap = {
    SWAP: 0,
    NO_SWAP: 1
  };

  Skew.ExtractGroupsMode = {
    ALL_SYMBOLS: 0,
    ONLY_LOCAL_VARIABLES: 1,
    ONLY_INSTANCE_VARIABLES: 2
  };

  Skew.SymbolGroup = function(symbols, count) {
    var self = this;
    self.symbols = symbols;
    self.count = count;
  };

  Skew.JsEmitter = function(options, cache) {
    var self = this;
    Skew.Emitter.call(self);
    self.options = options;
    self.cache = cache;
    self.needsMultiply = false;
    self.prefix = "";
    self.previousNode = null;
    self.previousSymbol = null;
    self.enclosingFunction = null;
    self.$extends = null;
    self.multiply = null;
    self.allSymbols = [];
    self.localVariableUnionFind = new Skew.UnionFind();
    self.namingGroupIndexForSymbol = Object.create(null);
    self.nextSymbolName = 0;
    self.symbolCounts = Object.create(null);
    self.mangle = false;
    self.minify = false;
    self.needsSemicolon = false;
    self.newline = "\n";
    self.space = " ";
  };

  __extends(Skew.JsEmitter, Skew.Emitter);

  Skew.JsEmitter.prototype.visit = function(global) {
    var self = this;
    self.mangle = self.options.jsMangle;
    self.minify = self.options.jsMinify;

    if (self.minify) {
      self.indentAmount = "";
      self.newline = "";
      self.space = "";
    }

    // Preprocess the code
    self.prepareGlobal(global);
    Skew.shakingPass(global, self.cache.entryPointSymbol, Skew.ShakingMode.IGNORE_TYPES);
    self.convertLambdasToFunctions(global);
    var objects = self.sortedObjects(global);

    // The entire body of code is wrapped in a closure for safety
    self.emit(self.indent + "(function()" + self.space + "{" + self.newline);
    self.increaseIndent();

    // Emit special-cased variables that must come first
    if (Skew.JsEmitter.needsExtends(objects)) {
      self.emitFunction(self.convertLambdaToFunction(self.$extends));
    }

    if (self.needsMultiply) {
      self.emitVariable(self.multiply);
    }

    // Emit objects and functions
    for (var i = 0, list = objects, count = list.length; i < count; ++i) {
      var object = list[i];
      self.emitObject(object);
    }

    // Emit variables
    for (var i2 = 0, list2 = objects, count2 = list2.length; i2 < count2; ++i2) {
      var object1 = list2[i2];
      var o = object1;
      self.prefix = "";

      while (o.kind !== Skew.SymbolKind.OBJECT_GLOBAL) {
        self.prefix = Skew.JsEmitter.mangleName(o) + "." + self.prefix;
        o = o.parent.asObjectSymbol();
      }

      for (var i1 = 0, list1 = object1.variables, count1 = list1.length; i1 < count1; ++i1) {
        var variable = list1[i1];

        if (variable !== self.$extends && variable !== self.multiply) {
          self.emitVariable(variable);
        }
      }
    }

    // Emit entry point
    var entryPointSymbol = self.cache.entryPointSymbol;

    if (entryPointSymbol !== null) {
      var type = entryPointSymbol.resolvedType;
      var callText = Skew.JsEmitter.fullName(entryPointSymbol) + (type.argumentTypes.length === 0 ? "()" : "(process.argv.slice(2))");
      self.emitSemicolonIfNeeded();
      self.emit(self.newline + self.indent + (type.returnType === self.cache.intType ? "process.exit(" + callText + ")" : callText));
      self.emitSemicolonAfterStatement();
    }

    // End the closure wrapping everything
    self.decreaseIndent();
    self.emit(self.indent + "})();\n");
    self.createSource(self.options.outputDirectory !== "" ? self.options.outputDirectory + "/compiled.js" : self.options.outputFile);
  };

  Skew.JsEmitter.prototype.prepareGlobal = function(global) {
    var self = this;
    var globalObjects = [];
    var globalFunctions = [];
    var globalVariables = [];

    // Load special-cased variables
    for (var i = 0, list = global.variables, count = list.length; i < count; ++i) {
      var variable = list[i];

      if (variable.name === "__extends") {
        self.$extends = variable;

        if (self.multiply !== null) {
          break;
        }
      }

      else if (variable.name === "__imul") {
        self.multiply = variable;

        if (self.$extends !== null) {
          break;
        }
      }
    }

    assert(self.$extends !== null);
    assert(self.multiply !== null);

    // Lower certain stuff into JavaScript (for example, "x as bool" becomes "!!x")
    self.patchObject(global, globalObjects, globalFunctions, globalVariables);

    // Skip everything below if we aren't mangling
    if (!self.mangle) {
      return;
    }

    // Move internal global symbols up to the global namespace
    for (var i1 = 0, list1 = globalObjects, count1 = list1.length; i1 < count1; ++i1) {
      var object = list1[i1];
      object.parent = global;
    }

    for (var i2 = 0, list2 = globalFunctions, count2 = list2.length; i2 < count2; ++i2) {
      var $function = list2[i2];
      $function.parent = global;
    }

    for (var i3 = 0, list3 = globalVariables, count3 = list3.length; i3 < count3; ++i3) {
      var variable1 = list3[i3];
      variable1.parent = global;
    }

    in_List.append2(global.objects, globalObjects);
    in_List.append2(global.functions, globalFunctions);
    in_List.append2(global.variables, globalVariables);

    // Rename symbols based on frequency for better compression
    self.renameSymbols();
  };

  Skew.JsEmitter.prototype.convertLambdaToFunction = function(variable) {
    var self = this;
    var $function = variable.value.symbol.asFunctionSymbol();
    $function.kind = Skew.SymbolKind.FUNCTION_GLOBAL;
    $function.parent = variable.parent;
    $function.name = variable.name;
    return $function;
  };

  Skew.JsEmitter.prototype.convertLambdasToFunctions = function(symbol) {
    var self = this;

    for (var i = 0, list = symbol.objects, count = list.length; i < count; ++i) {
      var object = list[i];
      self.convertLambdasToFunctions(object);
    }

    in_List.removeIf(symbol.variables, function(variable) {
      if (variable.kind === Skew.SymbolKind.VARIABLE_GLOBAL && variable.isConst() && !variable.isExported() && variable.value !== null && variable.value.kind === Skew.NodeKind.LAMBDA) {
        symbol.functions.push(self.convertLambdaToFunction(variable));
        return true;
      }

      return false;
    });
  };

  Skew.JsEmitter.prototype.allocateNamingGroupIndex = function(symbol) {
    var self = this;

    if (self.mangle && !(symbol.id in self.namingGroupIndexForSymbol)) {
      var index = self.localVariableUnionFind.allocate1();
      self.namingGroupIndexForSymbol[symbol.id] = index;
      self.allSymbols.push(symbol);

      // Explicitly add function arguments since they won't be reached by
      // normal tree traversal
      if (Skew.SymbolKind.isFunction(symbol.kind)) {
        var context = symbol.asFunctionSymbol().self;

        if (context !== null) {
          self.allocateNamingGroupIndex(context);
        }

        for (var i = 0, list = symbol.asFunctionSymbol().$arguments, count = list.length; i < count; ++i) {
          var argument = list[i];
          self.allocateNamingGroupIndex(argument);
        }
      }
    }
  };

  Skew.JsEmitter.prototype.renameSymbols = function() {
    var self = this;

    // This holds the groups used for naming. Unioning two labels using
    // this object will cause both groups of symbols to have the same name.
    var namingGroupsUnionFind = new Skew.UnionFind().allocate2(self.allSymbols.length);

    // These are optional and only reduce the number of generated names
    var order = [];
    self.aliasLocalVariables(namingGroupsUnionFind, order);
    self.aliasUnrelatedProperties(namingGroupsUnionFind, order);

    // Ensure all overridden symbols have the same generated name. This is
    // manditory for correctness, otherwise virtual functions break.
    for (var i = 0, list = self.allSymbols, count1 = list.length; i < count1; ++i) {
      var symbol = list[i];

      if (Skew.SymbolKind.isFunction(symbol.kind) && symbol.asFunctionSymbol().overridden !== null) {
        assert(symbol.id in self.namingGroupIndexForSymbol);
        assert(symbol.asFunctionSymbol().overridden.id in self.namingGroupIndexForSymbol);
        namingGroupsUnionFind.union(self.namingGroupIndexForSymbol[symbol.id], self.namingGroupIndexForSymbol[symbol.asFunctionSymbol().overridden.id]);
      }
    }

    // Collect all reserved names together into one big set for querying
    var reservedNames = Object.create(null);

    for (var i1 = 0, list1 = self.allSymbols, count2 = list1.length; i1 < count2; ++i1) {
      var symbol1 = list1[i1];

      if (symbol1.isImportedOrExported()) {
        reservedNames[symbol1.name] = 0;
      }
    }

    // Everything that should have the same name is now grouped together.
    // Generate and assign names to all internal symbols, but use shorter
    // names for more frequently used symbols.
    var sortedGroups = [];

    for (var i3 = 0, list3 = self.extractGroups(namingGroupsUnionFind, Skew.ExtractGroupsMode.ALL_SYMBOLS), count4 = list3.length; i3 < count4; ++i3) {
      var group = list3[i3];
      var count = 0;

      for (var i2 = 0, list2 = group, count3 = list2.length; i2 < count3; ++i2) {
        var symbol2 = list2[i2];

        if (!symbol2.isImportedOrExported()) {
          count += in_IntMap.get(self.symbolCounts, symbol2.id, 0);
        }
      }

      sortedGroups.push(new Skew.SymbolGroup(group, count));
    }

    sortedGroups.sort(function(a, b) {
      return b.count - a.count | 0;
    });

    for (var i5 = 0, list5 = sortedGroups, count6 = list5.length; i5 < count6; ++i5) {
      var group1 = list5[i5];
      var name = "";

      for (var i4 = 0, list4 = group1.symbols, count5 = list4.length; i4 < count5; ++i4) {
        var symbol3 = list4[i4];

        if (!symbol3.isImportedOrExported()) {
          if (name === "") {
            name = self.generateSymbolName(reservedNames);
          }

          symbol3.name = name;
        }
      }
    }
  };

  // Merge local variables from different functions together in the order
  // they were declared. This will cause every argument list to use the same
  // variables in the same order, which should offer better gzip:
  //
  //   function d(a, b) {}
  //   function e(a, b, c) {}
  //
  Skew.JsEmitter.prototype.aliasLocalVariables = function(unionFind, order) {
    var self = this;
    self.zipTogetherInOrder(unionFind, order, self.extractGroups(self.localVariableUnionFind, Skew.ExtractGroupsMode.ONLY_LOCAL_VARIABLES));
  };

  // Merge all related types together into naming groups. This ensures names
  // will be unique within a subclass hierarchy allowing names to be
  // duplicated in separate subclass hierarchies.
  Skew.JsEmitter.prototype.aliasUnrelatedProperties = function(unionFind, order) {
    var self = this;
    var relatedTypesUnionFind = new Skew.UnionFind().allocate2(self.allSymbols.length);

    for (var i = 0, count1 = self.allSymbols.length; i < count1; ++i) {
      var symbol = self.allSymbols[i];

      if (symbol.kind === Skew.SymbolKind.OBJECT_CLASS) {
        var baseClass = symbol.asObjectSymbol().baseClass;

        if (baseClass !== null) {
          relatedTypesUnionFind.union(i, self.namingGroupIndexForSymbol[baseClass.id]);
        }

        for (var i1 = 0, list = symbol.asObjectSymbol().variables, count = list.length; i1 < count; ++i1) {
          var variable = list[i1];
          relatedTypesUnionFind.union(i, self.namingGroupIndexForSymbol[variable.id]);
        }
      }
    }

    self.zipTogetherInOrder(unionFind, order, self.extractGroups(relatedTypesUnionFind, Skew.ExtractGroupsMode.ONLY_INSTANCE_VARIABLES));
  };

  Skew.JsEmitter.prototype.zipTogetherInOrder = function(unionFind, order, groups) {
    var self = this;

    for (var i1 = 0, list = groups, count1 = list.length; i1 < count1; ++i1) {
      var group = list[i1];

      for (var i = 0, count = group.length; i < count; ++i) {
        var symbol = group[i];
        var index = self.namingGroupIndexForSymbol[symbol.id];

        if (i >= order.length) {
          order.push(index);
        }

        else {
          unionFind.union(index, order[i]);
        }
      }
    }
  };

  Skew.JsEmitter.prototype.numberToName = function(number) {
    var self = this;
    var WRAP = __imul(26, 2);
    var name = "";

    if (number >= WRAP) {
      name = self.numberToName((number / WRAP | 0) - 1 | 0);
      number = number % WRAP | 0;
    }

    name += String.fromCharCode(number + (number < 26 ? 97 : 65 - 26 | 0) | 0);
    return name;
  };

  Skew.JsEmitter.prototype.generateSymbolName = function(reservedNames) {
    var self = this;

    while (true) {
      var name = self.numberToName(self.nextSymbolName);
      ++self.nextSymbolName;

      if (!(name in reservedNames)) {
        return name;
      }
    }
  };

  Skew.JsEmitter.prototype.extractGroups = function(unionFind, mode) {
    var self = this;
    var labelToGroup = Object.create(null);

    for (var i = 0, list = self.allSymbols, count = list.length; i < count; ++i) {
      var symbol = list[i];

      if (mode === Skew.ExtractGroupsMode.ONLY_LOCAL_VARIABLES && symbol.kind !== Skew.SymbolKind.VARIABLE_LOCAL || mode === Skew.ExtractGroupsMode.ONLY_INSTANCE_VARIABLES && symbol.kind !== Skew.SymbolKind.VARIABLE_INSTANCE) {
        continue;
      }

      assert(symbol.id in self.namingGroupIndexForSymbol);
      var label = unionFind.find(self.namingGroupIndexForSymbol[symbol.id]);
      var group = in_IntMap.get(labelToGroup, label, null);

      if (group === null) {
        group = [];
        labelToGroup[label] = group;
      }

      group.push(symbol);
    }

    return in_IntMap.values(labelToGroup);
  };

  Skew.JsEmitter.prototype.emitSemicolonAfterStatement = function() {
    var self = this;

    if (!self.minify) {
      self.emit(";\n");
    }

    else {
      self.needsSemicolon = true;
    }
  };

  Skew.JsEmitter.prototype.emitSemicolonIfNeeded = function() {
    var self = this;

    if (self.needsSemicolon) {
      self.emit(";");
      self.needsSemicolon = false;
    }
  };

  Skew.JsEmitter.prototype.emitNewlineBeforeSymbol = function(symbol) {
    var self = this;
    self.emitSemicolonIfNeeded();

    if (!self.minify && self.previousSymbol !== null && (!Skew.SymbolKind.isObject(self.previousSymbol.kind) || !Skew.SymbolKind.isObject(symbol.kind) || symbol.comments !== null || self.previousSymbol.kind === Skew.SymbolKind.OBJECT_ENUM || symbol.kind === Skew.SymbolKind.OBJECT_ENUM) && (!Skew.SymbolKind.isVariable(self.previousSymbol.kind) || !Skew.SymbolKind.isVariable(symbol.kind) || symbol.comments !== null)) {
      self.emit("\n");
    }

    self.previousSymbol = null;
  };

  Skew.JsEmitter.prototype.emitNewlineAfterSymbol = function(symbol) {
    var self = this;
    self.previousSymbol = symbol;
  };

  Skew.JsEmitter.prototype.emitNewlineBeforeStatement = function(node) {
    var self = this;

    if (!self.minify && self.previousNode !== null && (node.comments !== null || !Skew.JsEmitter.isCompactNodeKind(self.previousNode.kind) || !Skew.JsEmitter.isCompactNodeKind(node.kind))) {
      self.emit("\n");
    }

    self.previousNode = null;
  };

  Skew.JsEmitter.prototype.emitNewlineAfterStatement = function(node) {
    var self = this;
    self.previousNode = node;
  };

  Skew.JsEmitter.prototype.emitComments = function(comments) {
    var self = this;

    if (comments !== null && !self.minify) {
      for (var i = 0, list = comments, count = list.length; i < count; ++i) {
        var comment = list[i];
        self.emit(self.indent + "//" + comment);
      }
    }
  };

  Skew.JsEmitter.prototype.emitObject = function(symbol) {
    var self = this;

    if (symbol.isImported()) {
      return;
    }

    self.prefix = symbol.parent !== null ? Skew.JsEmitter.computePrefix(symbol.parent.asObjectSymbol()) : "";

    switch (symbol.kind) {
      case Skew.SymbolKind.OBJECT_NAMESPACE:
      case Skew.SymbolKind.OBJECT_INTERFACE: {
        self.emitNewlineBeforeSymbol(symbol);
        self.emitComments(symbol.comments);
        self.emit(self.indent + (self.prefix === "" && !symbol.isExported() ? "var " : self.prefix) + Skew.JsEmitter.mangleName(symbol) + self.space + "=" + self.space + "{}");
        self.emitSemicolonAfterStatement();
        self.emitNewlineAfterSymbol(symbol);
        break;
      }

      case Skew.SymbolKind.OBJECT_ENUM: {
        self.emitNewlineBeforeSymbol(symbol);
        self.emitComments(symbol.comments);
        self.emit(self.indent + (self.prefix === "" && !symbol.isExported() ? "var " : self.prefix) + Skew.JsEmitter.mangleName(symbol) + self.space + "=" + self.space + "{");
        self.increaseIndent();
        var isFirst = true;

        for (var i = 0, list = symbol.variables, count = list.length; i < count; ++i) {
          var variable = list[i];

          if (variable.kind === Skew.SymbolKind.VARIABLE_ENUM) {
            if (isFirst) {
              isFirst = false;
            }

            else {
              self.emit(",");
            }

            self.emit(self.newline);
            self.emitNewlineBeforeSymbol(variable);
            self.emitComments(variable.comments);
            self.emit(self.indent + Skew.JsEmitter.mangleName(variable) + ":" + self.space);
            self.emitContent(variable.value.content);
            self.emitNewlineAfterSymbol(variable);
          }
        }

        self.decreaseIndent();

        if (!isFirst && !self.minify) {
          self.emit("\n" + self.indent);
        }

        self.emit("}");
        self.emitSemicolonAfterStatement();
        self.emitNewlineAfterSymbol(symbol);
        break;
      }

      case Skew.SymbolKind.OBJECT_CLASS: {
        for (var i1 = 0, list1 = symbol.functions, count1 = list1.length; i1 < count1; ++i1) {
          var $function = list1[i1];

          if ($function.isPrimaryConstructor()) {
            if ($function.comments === null && symbol.comments !== null) {
              $function.comments = symbol.comments;
            }

            self.emitFunction($function);

            if (symbol.baseClass !== null) {
              if (!self.minify) {
                self.emit("\n" + self.indent);
              }

              self.emitSemicolonIfNeeded();
              self.emit(Skew.JsEmitter.mangleName(self.$extends) + "(" + Skew.JsEmitter.fullName(symbol) + "," + self.space + Skew.JsEmitter.fullName(symbol.baseClass) + ")");
              self.emitSemicolonAfterStatement();
            }
          }
        }
        break;
      }
    }

    if (symbol.kind !== Skew.SymbolKind.OBJECT_GLOBAL) {
      self.prefix += Skew.JsEmitter.mangleName(symbol) + ".";
    }

    for (var i2 = 0, list2 = symbol.functions, count2 = list2.length; i2 < count2; ++i2) {
      var function1 = list2[i2];

      if (!function1.isPrimaryConstructor()) {
        self.emitFunction(function1);
      }
    }
  };

  Skew.JsEmitter.prototype.emitArgumentList = function($arguments) {
    var self = this;

    for (var i = 0, count = $arguments.length; i < count; ++i) {
      if (i > 0) {
        self.emit("," + self.space);
      }

      self.emit(Skew.JsEmitter.mangleName($arguments[i]));
    }
  };

  Skew.JsEmitter.prototype.emitFunction = function(symbol) {
    var self = this;

    if (symbol.block === null) {
      return;
    }

    self.emitNewlineBeforeSymbol(symbol);
    self.emitComments(symbol.comments);
    var isExpression = self.prefix !== "" || symbol.isExported();
    var name = Skew.JsEmitter.mangleName(symbol.isPrimaryConstructor() ? symbol.parent : symbol);

    if (isExpression) {
      self.emit(self.indent + self.prefix + (symbol.kind === Skew.SymbolKind.FUNCTION_INSTANCE ? "prototype." : "") + name + self.space + "=" + self.space + "function(");
    }

    else {
      self.emit(self.indent + "function " + name + "(");
    }

    self.emitArgumentList(symbol.$arguments);
    self.emit(")" + self.space + "{" + self.newline);
    self.increaseIndent();
    self.enclosingFunction = symbol;
    self.emitStatements(symbol.block.children);
    self.enclosingFunction = null;
    self.decreaseIndent();
    self.emit(self.indent + "}");

    if (isExpression) {
      self.emitSemicolonAfterStatement();
    }

    else {
      self.needsSemicolon = false;
      self.emit(self.newline);
    }

    self.emitNewlineAfterSymbol(symbol);

    if (symbol.kind === Skew.SymbolKind.FUNCTION_CONSTRUCTOR && !symbol.isPrimaryConstructor()) {
      self.emitSemicolonIfNeeded();
      self.emit(self.newline + self.indent + Skew.JsEmitter.fullName(symbol) + ".prototype" + self.space + "=" + self.space + Skew.JsEmitter.fullName(symbol.parent) + ".prototype");
      self.emitSemicolonAfterStatement();
    }
  };

  Skew.JsEmitter.prototype.emitVariable = function(symbol) {
    var self = this;

    if (symbol.isImported()) {
      return;
    }

    if (symbol.kind !== Skew.SymbolKind.VARIABLE_INSTANCE && symbol.kind !== Skew.SymbolKind.VARIABLE_ENUM && (symbol.value !== null || self.prefix === "" || symbol.kind === Skew.SymbolKind.VARIABLE_LOCAL)) {
      self.emitNewlineBeforeSymbol(symbol);
      self.emitComments(symbol.comments);
      self.emit(self.indent + (self.prefix === "" && !symbol.isExported() || symbol.kind === Skew.SymbolKind.VARIABLE_LOCAL ? "var " : self.prefix) + Skew.JsEmitter.mangleName(symbol));

      if (symbol.value !== null) {
        self.emit(self.space + "=" + self.space);
        self.emitExpression(symbol.value, Skew.Precedence.COMMA);
      }

      self.emitSemicolonAfterStatement();
      self.emitNewlineAfterSymbol(symbol);
    }
  };

  Skew.JsEmitter.prototype.emitStatements = function(statements) {
    var self = this;
    self.previousNode = null;

    for (var i = 0, list = statements, count = list.length; i < count; ++i) {
      var statement = list[i];
      self.emitSemicolonIfNeeded();
      self.emitNewlineBeforeStatement(statement);
      self.emitComments(statement.comments);
      self.emitStatement(statement);
      self.emitNewlineAfterStatement(statement);
    }

    self.previousNode = null;
  };

  Skew.JsEmitter.prototype.emitBlock = function(node, after, mode) {
    var self = this;
    var shouldMinify = mode === Skew.JsEmitter.BracesMode.CAN_OMIT_BRACES && self.minify;

    if (shouldMinify && !node.hasChildren()) {
      self.emit(";");
    }

    else if (shouldMinify && node.children.length === 1) {
      if (after === Skew.JsEmitter.AfterToken.AFTER_KEYWORD) {
        self.emit(" ");
      }

      self.emitStatement(node.children[0]);
    }

    else {
      self.emit(self.space + "{" + self.newline);

      if (node.hasChildren()) {
        self.increaseIndent();
        self.emitStatements(node.children);
        self.decreaseIndent();
      }

      self.emit(self.indent + "}");
      self.needsSemicolon = false;
    }
  };

  Skew.JsEmitter.prototype.emitStatement = function(node) {
    var self = this;

    switch (node.kind) {
      case Skew.NodeKind.VAR: {
        self.emitVariable(node.symbol.asVariableSymbol());
        break;
      }

      case Skew.NodeKind.EXPRESSION: {
        self.emit(self.indent);
        self.emitExpression(node.expressionValue(), Skew.Precedence.LOWEST);
        self.emitSemicolonAfterStatement();
        break;
      }

      case Skew.NodeKind.BREAK: {
        self.emit(self.indent + "break");
        self.emitSemicolonAfterStatement();
        break;
      }

      case Skew.NodeKind.CONTINUE: {
        self.emit(self.indent + "continue");
        self.emitSemicolonAfterStatement();
        break;
      }

      case Skew.NodeKind.RETURN: {
        self.emit(self.indent + "return");
        var value = node.returnValue();

        if (value !== null) {
          self.emit(" ");
          self.emitExpression(value, Skew.Precedence.LOWEST);
        }

        self.emitSemicolonAfterStatement();
        break;
      }

      case Skew.NodeKind.THROW: {
        self.emit(self.indent + "throw ");
        self.emitExpression(node.throwValue(), Skew.Precedence.LOWEST);
        self.emitSemicolonAfterStatement();
        break;
      }

      case Skew.NodeKind.FOR: {
        var test = node.forTest();
        var update = node.forUpdate();
        var children = node.children;
        var count = children.length;
        self.emit(self.indent + "for" + self.space + "(");

        if (count > 3) {
          for (var i = 3, count1 = count; i < count1; ++i) {
            var child = children[i];
            assert(child.kind === Skew.NodeKind.VAR);

            if (i !== 3) {
              self.emit("," + self.space);
            }

            var symbol = child.symbol.asVariableSymbol();

            if (i === 3) {
              self.emit("var ");
            }

            self.emit(Skew.JsEmitter.mangleName(symbol) + self.space + "=" + self.space);
            self.emitExpression(symbol.value, Skew.Precedence.COMMA);
          }
        }

        self.emit(";" + self.space);

        if (test !== null) {
          self.emitExpression(test, Skew.Precedence.LOWEST);
        }

        self.emit(";" + self.space);

        if (update !== null) {
          self.emitExpression(update, Skew.Precedence.LOWEST);
        }

        self.emit(")");
        self.emitBlock(node.forBlock(), Skew.JsEmitter.AfterToken.AFTER_PARENTHESIS, Skew.JsEmitter.BracesMode.MUST_KEEP_BRACES);
        self.emit(self.newline);
        break;
      }

      case Skew.NodeKind.FOREACH: {
        self.emit(self.indent + "for" + self.space + "(var " + Skew.JsEmitter.mangleName(node.symbol) + " in ");
        self.emitExpression(node.foreachValue(), Skew.Precedence.LOWEST);
        self.emit(")");
        self.emitBlock(node.foreachBlock(), Skew.JsEmitter.AfterToken.AFTER_PARENTHESIS, Skew.JsEmitter.BracesMode.MUST_KEEP_BRACES);
        self.emit(self.newline);
        break;
      }

      case Skew.NodeKind.IF: {
        self.emit(self.indent);
        self.emitIf(node);
        self.emit(self.newline);
        break;
      }

      case Skew.NodeKind.SWITCH: {
        var cases = node.children;
        self.emit(self.indent + "switch" + self.space + "(");
        self.emitExpression(node.switchValue(), Skew.Precedence.LOWEST);
        self.emit(")" + self.space + "{" + self.newline);
        self.increaseIndent();

        for (var i1 = 1, count3 = cases.length; i1 < count3; ++i1) {
          var child1 = cases[i1];
          var values = child1.children;
          var block = child1.caseBlock();
          self.emitSemicolonIfNeeded();

          if (i1 !== 1) {
            self.emit(self.newline);
          }

          if (values.length === 1) {
            self.emit(self.indent + "default:");
          }

          else {
            for (var j = 1, count2 = values.length; j < count2; ++j) {
              if (j !== 1) {
                self.emit(self.newline);
              }

              self.emit(self.indent + "case ");
              self.emitExpression(values[j], Skew.Precedence.LOWEST);
              self.emit(":");
            }
          }

          if (!self.minify) {
            self.emit(" {\n");
            self.increaseIndent();
          }

          self.emitStatements(block.children);

          if (!block.blockAlwaysEndsWithReturn()) {
            self.emitSemicolonIfNeeded();
            self.emit(self.indent + "break");
            self.emitSemicolonAfterStatement();
          }

          if (!self.minify) {
            self.decreaseIndent();
            self.emit(self.indent + "}\n");
          }
        }

        self.decreaseIndent();
        self.emit(self.indent + "}" + self.newline);
        self.needsSemicolon = false;
        break;
      }

      case Skew.NodeKind.TRY: {
        var children1 = node.children;
        var finallyBlock = node.finallyBlock();
        self.emit(self.indent + "try");
        self.emitBlock(node.tryBlock(), Skew.JsEmitter.AfterToken.AFTER_KEYWORD, Skew.JsEmitter.BracesMode.MUST_KEEP_BRACES);
        self.emit(self.newline);

        for (var i2 = 1, count4 = children1.length - 1 | 0; i2 < count4; ++i2) {
          var child2 = children1[i2];
          self.emit(self.newline);
          self.emitComments(child2.comments);
          self.emit(self.indent + "catch" + self.space + "(" + (child2.symbol !== null ? Skew.JsEmitter.mangleName(child2.symbol) : "$e") + ")");
          self.emitBlock(child2.catchBlock(), Skew.JsEmitter.AfterToken.AFTER_KEYWORD, Skew.JsEmitter.BracesMode.MUST_KEEP_BRACES);
          self.emit(self.newline);
        }

        if (finallyBlock !== null) {
          self.emit(self.newline);
          self.emitComments(finallyBlock.comments);
          self.emit(self.indent + "finally");
          self.emitBlock(finallyBlock, Skew.JsEmitter.AfterToken.AFTER_KEYWORD, Skew.JsEmitter.BracesMode.MUST_KEEP_BRACES);
          self.emit(self.newline);
        }
        break;
      }

      case Skew.NodeKind.WHILE: {
        self.emit(self.indent + "while" + self.space + "(");
        self.emitExpression(node.whileTest(), Skew.Precedence.LOWEST);
        self.emit(")");
        self.emitBlock(node.whileBlock(), Skew.JsEmitter.AfterToken.AFTER_PARENTHESIS, Skew.JsEmitter.BracesMode.CAN_OMIT_BRACES);
        self.emit(self.newline);
        break;
      }

      default: {
        assert(false);
        break;
      }
    }
  };

  Skew.JsEmitter.prototype.emitIf = function(node) {
    var self = this;
    var trueBlock = node.ifTrue();
    var falseBlock = node.ifFalse();
    self.emit("if" + self.space + "(");
    self.emitExpression(node.ifTest(), Skew.Precedence.LOWEST);
    self.emit(")");

    // Make sure to always keep braces to avoid the dangling "else" case
    var trueStatement = trueBlock.blockStatement();
    self.emitBlock(node.ifTrue(), Skew.JsEmitter.AfterToken.AFTER_PARENTHESIS, falseBlock !== null && trueStatement !== null && trueStatement.kind === Skew.NodeKind.IF ? Skew.JsEmitter.BracesMode.MUST_KEEP_BRACES : Skew.JsEmitter.BracesMode.CAN_OMIT_BRACES);

    if (falseBlock !== null) {
      var falseStatement = falseBlock.blockStatement();
      var singleIf = falseStatement !== null && falseStatement.kind === Skew.NodeKind.IF ? falseStatement : null;
      self.emitSemicolonIfNeeded();
      self.emit(self.newline + self.newline);
      self.emitComments(falseBlock.comments);

      if (singleIf !== null) {
        self.emitComments(singleIf.comments);
      }

      self.emit(self.indent + "else");

      if (singleIf !== null) {
        self.emit(" ");
        self.emitIf(singleIf);
      }

      else {
        self.emitBlock(falseBlock, Skew.JsEmitter.AfterToken.AFTER_KEYWORD, Skew.JsEmitter.BracesMode.CAN_OMIT_BRACES);
      }
    }
  };

  Skew.JsEmitter.prototype.emitContent = function(content) {
    var self = this;

    switch (content.kind()) {
      case Skew.ContentKind.BOOL: {
        self.emit(content.asBool().toString());
        break;
      }

      case Skew.ContentKind.INT: {
        self.emit(content.asInt().toString());
        break;
      }

      case Skew.ContentKind.DOUBLE: {
        self.emit(content.asDouble().toString());
        break;
      }

      case Skew.ContentKind.STRING: {
        self.emit(Skew.quoteString(content.asString(), 34));
        break;
      }
    }
  };

  Skew.JsEmitter.prototype.emitExpression = function(node, precedence) {
    var self = this;
    var kind = node.kind;

    switch (kind) {
      case Skew.NodeKind.TYPE: {
        self.emit(Skew.JsEmitter.fullName(node.resolvedType.symbol));
        break;
      }

      case Skew.NodeKind.NULL: {
        self.emit("null");
        break;
      }

      case Skew.NodeKind.NAME: {
        var symbol = node.symbol;
        self.emit(symbol !== null ? Skew.JsEmitter.fullName(symbol) : node.asString());
        break;
      }

      case Skew.NodeKind.DOT: {
        self.emitExpression(node.dotTarget(), Skew.Precedence.MEMBER);
        self.emit("." + (node.symbol !== null ? Skew.JsEmitter.mangleName(node.symbol) : node.asString()));
        break;
      }

      case Skew.NodeKind.CONSTANT: {
        self.emitContent(node.content);
        break;
      }

      case Skew.NodeKind.CALL: {
        var value = node.callValue();
        var call = value.kind === Skew.NodeKind.SUPER;
        var wrap = value.kind === Skew.NodeKind.LAMBDA && node.parent !== null && node.parent.kind === Skew.NodeKind.EXPRESSION;

        if (wrap) {
          self.emit("(");
        }

        if (!call && node.symbol !== null && node.symbol.kind === Skew.SymbolKind.FUNCTION_CONSTRUCTOR) {
          self.emit("new " + Skew.JsEmitter.fullName(node.symbol));
        }

        else {
          self.emitExpression(value, Skew.Precedence.UNARY_POSTFIX);

          if (call) {
            self.emit(".call");
          }
        }

        if (wrap) {
          self.emit(")");
        }

        self.emit("(");

        if (call) {
          self.emit(Skew.JsEmitter.mangleName(self.enclosingFunction.self));
        }

        for (var i = 1, count = node.children.length; i < count; ++i) {
          if (call || i > 1) {
            self.emit("," + self.space);
          }

          self.emitExpression(node.children[i], Skew.Precedence.COMMA);
        }

        self.emit(")");
        break;
      }

      case Skew.NodeKind.INITIALIZER_LIST:
      case Skew.NodeKind.INITIALIZER_MAP:
      case Skew.NodeKind.INITIALIZER_SET: {
        var children = node.children;
        var useBraces = kind === Skew.NodeKind.INITIALIZER_MAP || kind === Skew.NodeKind.INITIALIZER_SET && children.length === 0;
        var isIndented = !self.minify && children.some(function(child) {
          return child.comments !== null;
        });
        self.emit(useBraces ? "{" : "[");

        if (isIndented) {
          self.increaseIndent();
        }

        for (var i1 = 0, list = children, count1 = list.length; i1 < count1; ++i1) {
          var child = list[i1];

          if (child !== children[0]) {
            self.emit("," + (isIndented ? "" : self.space));
          }

          if (isIndented) {
            self.emit("\n");
            self.emitComments(child.comments);
            self.emit(self.indent);
          }

          self.emitExpression(child, Skew.Precedence.COMMA);
        }

        if (isIndented) {
          self.decreaseIndent();
          self.emit("\n" + self.indent);
        }

        self.emit(useBraces ? "}" : "]");
        break;
      }

      case Skew.NodeKind.PAIR: {
        self.emitExpression(node.firstValue(), Skew.Precedence.LOWEST);
        self.emit(":" + self.space);
        self.emitExpression(node.secondValue(), Skew.Precedence.LOWEST);
        break;
      }

      case Skew.NodeKind.INDEX: {
        assert(node.children.length === 2);
        self.emitExpression(node.children[0], Skew.Precedence.UNARY_POSTFIX);
        self.emit("[");
        self.emitExpression(node.children[1], Skew.Precedence.LOWEST);
        self.emit("]");
        break;
      }

      case Skew.NodeKind.ASSIGN_INDEX: {
        if (Skew.Precedence.ASSIGN < precedence) {
          self.emit("(");
        }

        assert(node.children.length === 3);
        self.emitExpression(node.children[0], Skew.Precedence.UNARY_POSTFIX);
        self.emit("[");
        self.emitExpression(node.children[1], Skew.Precedence.LOWEST);
        self.emit("]" + self.space + "=" + self.space + "");
        self.emitExpression(node.children[2], Skew.Precedence.LOWEST);

        if (Skew.Precedence.ASSIGN < precedence) {
          self.emit(")");
        }
        break;
      }

      case Skew.NodeKind.CAST: {
        self.emitExpression(node.castValue(), precedence);
        break;
      }

      case Skew.NodeKind.PARAMETERIZE: {
        self.emitExpression(node.parameterizeValue(), precedence);
        break;
      }

      case Skew.NodeKind.SEQUENCE: {
        if (Skew.Precedence.COMMA <= precedence) {
          self.emit("(");
        }

        for (var i2 = 0, count2 = node.children.length; i2 < count2; ++i2) {
          if (i2 !== 0) {
            self.emit("," + self.space);
          }

          self.emitExpression(node.children[i2], Skew.Precedence.COMMA);
        }

        if (Skew.Precedence.COMMA <= precedence) {
          self.emit(")");
        }
        break;
      }

      case Skew.NodeKind.SUPER: {
        self.emit(Skew.JsEmitter.fullName(node.symbol));
        break;
      }

      case Skew.NodeKind.HOOK: {
        if (Skew.Precedence.ASSIGN < precedence) {
          self.emit("(");
        }

        self.emitExpression(node.hookTest(), Skew.Precedence.LOGICAL_OR);
        self.emit(self.space + "?" + self.space);
        self.emitExpression(node.hookTrue(), Skew.Precedence.ASSIGN);
        self.emit(self.space + ":" + self.space);
        self.emitExpression(node.hookFalse(), Skew.Precedence.ASSIGN);

        if (Skew.Precedence.ASSIGN < precedence) {
          self.emit(")");
        }
        break;
      }

      case Skew.NodeKind.LAMBDA: {
        var symbol1 = node.symbol.asFunctionSymbol();
        self.emit("function(");
        self.emitArgumentList(symbol1.$arguments);
        self.emit(")");
        self.emitBlock(symbol1.block, Skew.JsEmitter.AfterToken.AFTER_PARENTHESIS, Skew.JsEmitter.BracesMode.MUST_KEEP_BRACES);
        break;
      }

      default: {
        if (Skew.NodeKind.isUnary(kind)) {
          var value1 = node.unaryValue();
          var info = Skew.operatorInfo[kind];

          if (info.precedence < precedence) {
            self.emit("(");
          }

          self.emit(info.text);
          self.emitExpression(value1, info.precedence);

          if (info.precedence < precedence) {
            self.emit(")");
          }
        }

        else if (Skew.NodeKind.isBinary(kind)) {
          var info1 = Skew.operatorInfo[kind];
          var right = node.binaryRight();

          if (info1.precedence < precedence) {
            self.emit("(");
          }

          self.emitExpression(node.binaryLeft(), info1.precedence + (info1.associativity === Skew.Associativity.RIGHT | 0) | 0);

          // Always emit spaces around keyword operators, even when minifying
          self.emit(kind === Skew.NodeKind.IN ? " in " : kind === Skew.NodeKind.IS ? " instanceof " : self.space + (kind === Skew.NodeKind.EQUAL ? "===" : kind === Skew.NodeKind.NOT_EQUAL ? "!==" : info1.text) + self.space);

          // Prevent "x - -1" from becoming "x--1"
          if (self.minify && (kind === Skew.NodeKind.ADD && (right.kind === Skew.NodeKind.POSITIVE || right.kind === Skew.NodeKind.INCREMENT) || kind === Skew.NodeKind.SUBTRACT && (right.kind === Skew.NodeKind.NEGATIVE || right.kind === Skew.NodeKind.DECREMENT || right.isNumberLessThanZero()))) {
            self.emit(" ");
          }

          self.emitExpression(right, info1.precedence + (info1.associativity === Skew.Associativity.LEFT | 0) | 0);

          if (info1.precedence < precedence) {
            self.emit(")");
          }
        }

        else {
          assert(false);
        }
        break;
      }
    }
  };

  Skew.JsEmitter.prototype.patchObject = function(symbol, globalObjects, globalFunctions, globalVariables) {
    var self = this;
    var shouldLiftGlobals = self.mangle && symbol.parent !== null;
    self.allocateNamingGroupIndex(symbol);

    // Scan over child objects
    in_List.removeIf(symbol.objects, function(object) {
      self.patchObject(object, globalObjects, globalFunctions, globalVariables);

      // When mangling, filter out all internal objects and move them to the global namespace
      if (shouldLiftGlobals && !object.isImportedOrExported()) {
        globalObjects.push(object);
        return true;
      }

      return false;
    });

    // Scan over child functions
    var isPrimaryConstructor = true;
    in_List.removeIf(symbol.functions, function($function) {
      self.allocateNamingGroupIndex($function);

      if ($function.self !== null) {
        self.unionVariableWithFunction($function.self, $function);

        if ($function.block !== null) {
          $function.self.value = new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent("this"));
          $function.block.children.unshift(Skew.Node.createVar($function.self));
        }
      }

      self.enclosingFunction = $function;
      self.patchNode($function.block);
      self.enclosingFunction = null;

      for (var i = 0, list = $function.$arguments, count = list.length; i < count; ++i) {
        var argument = list[i];
        self.allocateNamingGroupIndex(argument);
        self.unionVariableWithFunction(argument, $function);
      }

      // When mangling, filter out all internal global functions and move them to the global namespace
      if (shouldLiftGlobals && $function.kind === Skew.SymbolKind.FUNCTION_GLOBAL && !$function.isImportedOrExported()) {
        globalFunctions.push($function);
        return true;
      }

      // Rename extra constructors overloads so they don't conflict
      if ($function.kind === Skew.SymbolKind.FUNCTION_CONSTRUCTOR) {
        if (isPrimaryConstructor) {
          $function.flags |= Skew.Symbol.IS_PRIMARY_CONSTRUCTOR;
          isPrimaryConstructor = false;
        }
      }

      return false;
    });

    // Scan over child variables
    in_List.removeIf(symbol.variables, function(variable) {
      self.allocateNamingGroupIndex(variable);
      self.patchNode(variable.value);

      // When mangling, filter out all internal global variables and move them to the global namespace
      if (shouldLiftGlobals && variable.kind === Skew.SymbolKind.VARIABLE_GLOBAL && !variable.isImportedOrExported()) {
        globalVariables.push(variable);
        return true;
      }

      return false;
    });
  };

  Skew.JsEmitter.prototype.createIntBinary = function(kind, left, right) {
    var self = this;

    if (kind === Skew.NodeKind.MULTIPLY) {
      self.needsMultiply = true;
      return Skew.Node.createCall(new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent(self.multiply.name)).withSymbol(self.multiply), [left, right]).withType(self.cache.intType);
    }

    return self.wrapWithIntCast(Skew.Node.createBinary(kind, left, right).withType(self.cache.intType));
  };

  Skew.JsEmitter.prototype.wrapWithNot = function(node) {
    var self = this;
    return Skew.Node.createUnary(Skew.NodeKind.NOT, node).withType(self.cache.boolType).withRange(node.range);
  };

  Skew.JsEmitter.prototype.wrapWithIntCast = function(node) {
    var self = this;
    return Skew.Node.createBinary(Skew.NodeKind.BITWISE_OR, node, new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.IntContent(0)).withType(self.cache.intType)).withType(self.cache.intType).withRange(node.range);
  };

  Skew.JsEmitter.prototype.patchBinaryArithmetic = function(node) {
    var self = this;

    // Make sure arithmetic integer operators don't emit doubles outside the
    // integer range. Allowing this causes JIT slowdowns due to extra checks
    // during compilation and potential deoptimizations during execution.
    if (node.resolvedType === self.cache.intType && !Skew.JsEmitter.alwaysConvertsOperandsToInt(node.parent)) {
      var left = node.binaryLeft();
      var right = node.binaryRight();

      if (left.resolvedType === self.cache.intType && right.resolvedType === self.cache.intType) {
        node.become(self.createIntBinary(node.kind, left.replaceWithNull(), right.replaceWithNull()).withRange(node.range));
      }
    }
  };

  // Group each variable inside the function with the function itself so that
  // they can be renamed together and won't cause any collisions inside the
  // function
  Skew.JsEmitter.prototype.unionVariableWithFunction = function(symbol, $function) {
    var self = this;

    if (self.mangle && $function !== null) {
      assert(symbol.id in self.namingGroupIndexForSymbol);
      assert($function.id in self.namingGroupIndexForSymbol);
      self.localVariableUnionFind.union(self.namingGroupIndexForSymbol[symbol.id], self.namingGroupIndexForSymbol[$function.id]);
    }
  };

  Skew.JsEmitter.prototype.patchNode = function(node) {
    var self = this;

    if (node === null) {
      return;
    }

    var oldEnclosingFunction = self.enclosingFunction;
    var children = node.children;
    var symbol = node.symbol;
    var kind = node.kind;

    if (self.mangle && symbol !== null) {
      self.allocateNamingGroupIndex(symbol);

      if (node.kind !== Skew.NodeKind.TYPE) {
        self.symbolCounts[symbol.id] = in_IntMap.get(self.symbolCounts, symbol.id, 0) + 1 | 0;
      }
    }

    if (children !== null) {
      if (kind === Skew.NodeKind.LAMBDA) {
        self.enclosingFunction = node.symbol.asFunctionSymbol();
      }

      for (var i = 0, list = children, count = list.length; i < count; ++i) {
        var child = list[i];
        self.patchNode(child);
      }

      if (kind === Skew.NodeKind.LAMBDA) {
        self.enclosingFunction = oldEnclosingFunction;
      }
    }

    switch (kind) {
      case Skew.NodeKind.ADD:
      case Skew.NodeKind.SUBTRACT:
      case Skew.NodeKind.MULTIPLY:
      case Skew.NodeKind.DIVIDE:
      case Skew.NodeKind.REMAINDER: {
        self.patchBinaryArithmetic(node);
        break;
      }

      case Skew.NodeKind.BLOCK: {
        if (self.mangle) {
          self.peepholeMangleBlock(node);
        }
        break;
      }

      case Skew.NodeKind.CAST: {
        self.patchCast(node);
        break;
      }

      case Skew.NodeKind.FOREACH: {
        self.unionVariableWithFunction(node.symbol, self.enclosingFunction);
        break;
      }

      case Skew.NodeKind.IF: {
        if (self.mangle) {
          self.peepholeMangleIf(node);
        }
        break;
      }

      case Skew.NodeKind.HOOK: {
        if (self.mangle) {
          self.peepholeMangleHook(node);
        }
        break;
      }

      case Skew.NodeKind.LAMBDA: {
        var $function = node.symbol.asFunctionSymbol();

        for (var i1 = 0, list1 = $function.$arguments, count1 = list1.length; i1 < count1; ++i1) {
          var argument = list1[i1];
          self.allocateNamingGroupIndex(argument);
          self.unionVariableWithFunction(argument, $function);
        }

        self.unionVariableWithFunction($function, self.enclosingFunction);
        break;
      }

      case Skew.NodeKind.VAR: {
        self.unionVariableWithFunction(node.symbol, self.enclosingFunction);
        break;
      }
    }
  };

  Skew.JsEmitter.prototype.assignSourceIfNoSideEffects = function(node) {
    var self = this;

    if (node.kind === Skew.NodeKind.ASSIGN) {
      var right = node.binaryRight();
      return node.binaryLeft().hasNoSideEffects() && right.hasNoSideEffects() ? right : null;
    }

    if (node.kind === Skew.NodeKind.ASSIGN_INDEX) {
      var children = node.children;
      return children.length === 3 && children[0].hasNoSideEffects() && children[1].hasNoSideEffects() && children[2].hasNoSideEffects() ? children[2] : null;
    }

    return null;
  };

  Skew.JsEmitter.prototype.peepholeMangleSequence = function(node) {
    var self = this;
    assert(node.kind === Skew.NodeKind.SEQUENCE);

    // "a = 0, b[c] = 0, d = 0;" => "a = b[c] = d = 0;"
    var i = node.children.length - 1 | 0;

    while (i > 0) {
      var current = node.children[i];
      var currentRight = self.assignSourceIfNoSideEffects(current);

      if (currentRight !== null) {
        while (i !== 0) {
          var previous = node.children[i - 1 | 0];
          var previousRight = self.assignSourceIfNoSideEffects(previous);

          if (previousRight === null || !self.looksTheSame(previousRight, currentRight)) {
            break;
          }

          previousRight.replaceWith(current.remove());
          current = previous;
          --i;
        }
      }

      --i;
    }
  };

  Skew.JsEmitter.prototype.joinExpressions = function(left, right) {
    var self = this;
    var sequence = new Skew.Node(Skew.NodeKind.SEQUENCE).withChildren(left.kind === Skew.NodeKind.SEQUENCE ? left.removeChildren() : [left]);
    sequence.appendChildren(right.kind === Skew.NodeKind.SEQUENCE ? right.removeChildren() : [right]);
    return sequence;
  };

  Skew.JsEmitter.prototype.looksTheSame = function(left, right) {
    var self = this;

    if (left.kind === right.kind) {
      switch (left.kind) {
        case Skew.NodeKind.NULL: {
          return true;
        }

        case Skew.NodeKind.CONSTANT: {
          switch (left.content.kind()) {
            case Skew.ContentKind.INT: {
              return right.isInt() && left.asInt() === right.asInt();
            }

            case Skew.ContentKind.BOOL: {
              return right.isBool() && left.asBool() === right.asBool();
            }

            case Skew.ContentKind.DOUBLE: {
              return right.isDouble() && left.asDouble() === right.asDouble();
            }

            case Skew.ContentKind.STRING: {
              return right.isString() && left.asString() === right.asString();
            }
          }
          break;
        }

        case Skew.NodeKind.NAME: {
          return left.symbol !== null && left.symbol === right.symbol || left.symbol === null && right.symbol === null && left.asString() === right.asString();
        }

        case Skew.NodeKind.DOT: {
          return left.symbol === right.symbol && self.looksTheSame(left.dotTarget(), right.dotTarget());
        }
      }
    }

    // Null literals are always implicitly casted, so unwrap implicit casts
    if (left.kind === Skew.NodeKind.CAST) {
      return self.looksTheSame(left.castValue(), right);
    }

    if (right.kind === Skew.NodeKind.CAST) {
      return self.looksTheSame(left, right.castValue());
    }

    return false;
  };

  // Simplifies the node assuming it's used in a boolean context
  Skew.JsEmitter.prototype.peepholeMangleBoolean = function(node, canSwap) {
    var self = this;
    var kind = node.kind;

    if (kind === Skew.NodeKind.EQUAL || kind === Skew.NodeKind.NOT_EQUAL) {
      var left = node.binaryLeft();
      var right = node.binaryRight();
      var replacement = Skew.JsEmitter.isFalsy(right) ? left : Skew.JsEmitter.isFalsy(left) ? right : null;

      // "if (a != 0) b;" => "if (a) b;"
      if (replacement !== null) {
        // This minification is not valid for floating-point values because
        // of NaN, since NaN != 0 but NaN is falsy in JavaScript
        if (left.resolvedType !== null && left.resolvedType !== self.cache.doubleType && right.resolvedType !== null && right.resolvedType !== self.cache.doubleType) {
          replacement.replaceWithNull();
          node.become(kind === Skew.NodeKind.EQUAL ? Skew.Node.createUnary(Skew.NodeKind.NOT, replacement) : replacement);
        }
      }

      else if (left.resolvedType === self.cache.intType && right.resolvedType === self.cache.intType && (kind === Skew.NodeKind.NOT_EQUAL || kind === Skew.NodeKind.EQUAL && canSwap === Skew.BooleanSwap.SWAP)) {
        // "if (a != -1) c;" => "if (~a) c;"
        // "if (a == -1) c; else d;" => "if (~a) d; else c;"
        if (right.isInt() && right.asInt() === -1) {
          node.become(Skew.Node.createUnary(Skew.NodeKind.COMPLEMENT, left.replaceWithNull()));
        }

        // "if (-1 != b) c;" => "if (~b) c;"
        // "if (-1 == b) c; else d;" => "if (~b) d; else c;"
        else if (left.isInt() && left.asInt() === -1) {
          node.become(Skew.Node.createUnary(Skew.NodeKind.COMPLEMENT, right.replaceWithNull()));
        }

        // "if (a != b) c;" => "if (a ^ b) c;"
        // "if (a == b) c; else d;" => "if (a ^ b) d; else c;"
        else {
          node.kind = Skew.NodeKind.BITWISE_XOR;
        }

        return kind === Skew.NodeKind.EQUAL ? Skew.BooleanSwap.SWAP : Skew.BooleanSwap.NO_SWAP;
      }
    }

    // "if (a != 0 || b != 0) c;" => "if (a || b) c;"
    else if (kind === Skew.NodeKind.LOGICAL_AND || kind === Skew.NodeKind.LOGICAL_OR) {
      self.peepholeMangleBoolean(node.binaryLeft(), Skew.BooleanSwap.NO_SWAP);
      self.peepholeMangleBoolean(node.binaryRight(), Skew.BooleanSwap.NO_SWAP);
    }

    // "if (!a) b; else c;" => "if (a) c; else b;"
    // "a == 0 ? b : c;" => "a ? c : b;"
    // This is not an "else if" check since EQUAL may be turned into NOT above
    if (node.kind === Skew.NodeKind.NOT && canSwap === Skew.BooleanSwap.SWAP) {
      node.become(node.unaryValue().replaceWithNull());
      return Skew.BooleanSwap.SWAP;
    }

    return Skew.BooleanSwap.NO_SWAP;
  };

  Skew.JsEmitter.prototype.peepholeMangleIf = function(node) {
    var self = this;
    var test = node.ifTest();
    var trueBlock = node.ifTrue();
    var falseBlock = node.ifFalse();
    var trueStatement = trueBlock.blockStatement();
    var swapped = self.peepholeMangleBoolean(test, falseBlock !== null || trueStatement !== null && trueStatement.kind === Skew.NodeKind.EXPRESSION ? Skew.BooleanSwap.SWAP : Skew.BooleanSwap.NO_SWAP);

    if (falseBlock !== null) {
      var falseStatement = falseBlock.blockStatement();

      // "if (!a) b; else c;" => "if (a) c; else b;"
      if (swapped === Skew.BooleanSwap.SWAP) {
        var block = trueBlock;
        trueBlock = falseBlock;
        falseBlock = block;
        var statement = trueStatement;
        trueStatement = falseStatement;
        falseStatement = statement;
        trueBlock.swapWith(falseBlock);
      }

      if (trueStatement !== null && falseStatement !== null) {
        // "if (a) b; else c;" => "a ? b : c;"
        if (trueStatement.kind === Skew.NodeKind.EXPRESSION && falseStatement.kind === Skew.NodeKind.EXPRESSION) {
          var hook = Skew.Node.createHook(test.replaceWithNull(), trueStatement.expressionValue().replaceWithNull(), falseStatement.expressionValue().replaceWithNull());
          self.peepholeMangleHook(hook);
          node.become(Skew.Node.createExpression(hook));
        }

        // "if (a) return b; else return c;" => "return a ? b : c;"
        else if (trueStatement.kind === Skew.NodeKind.RETURN && falseStatement.kind === Skew.NodeKind.RETURN) {
          var trueValue = trueStatement.returnValue();
          var falseValue = falseStatement.returnValue();

          if (trueValue !== null && falseValue !== null) {
            var hook1 = Skew.Node.createHook(test.replaceWithNull(), trueValue.replaceWithNull(), falseValue.replaceWithNull());
            self.peepholeMangleHook(hook1);
            node.become(Skew.Node.createReturn(hook1));
          }
        }
      }
    }

    // "if (a) b;" => "a && b;"
    // "if (!a) b;" => "a || b;"
    else if (trueStatement !== null && trueStatement.kind === Skew.NodeKind.EXPRESSION) {
      var value = trueStatement.expressionValue().replaceWithNull();
      node.become(Skew.Node.createExpression(Skew.Node.createBinary(swapped === Skew.BooleanSwap.SWAP ? Skew.NodeKind.LOGICAL_OR : Skew.NodeKind.LOGICAL_AND, test.replaceWithNull(), value)));
    }
  };

  Skew.JsEmitter.prototype.peepholeMangleHook = function(node) {
    var self = this;
    var test = node.hookTest();
    var trueValue = node.hookTrue();
    var falseValue = node.hookFalse();
    var swapped = self.peepholeMangleBoolean(test, Skew.BooleanSwap.SWAP);

    // "!a ? b : c;" => "a ? c : b;"
    if (swapped === Skew.BooleanSwap.SWAP) {
      var temp = trueValue;
      trueValue = falseValue;
      falseValue = temp;
      trueValue.swapWith(falseValue);
    }

    // "a ? a : b" => "a || b"
    if (self.looksTheSame(test, trueValue) && test.hasNoSideEffects()) {
      node.become(Skew.Node.createBinary(Skew.NodeKind.LOGICAL_OR, test.replaceWithNull(), falseValue.replaceWithNull()));
      return;
    }

    // "a ? b : a" => "a && b"
    if (self.looksTheSame(test, falseValue) && test.hasNoSideEffects()) {
      node.become(Skew.Node.createBinary(Skew.NodeKind.LOGICAL_AND, test.replaceWithNull(), trueValue.replaceWithNull()));
      return;
    }

    // "a ? b : b" => "a, b"
    if (self.looksTheSame(trueValue, falseValue)) {
      node.become(test.hasNoSideEffects() ? trueValue.replaceWithNull() : new Skew.Node(Skew.NodeKind.SEQUENCE).withChildren([test.replaceWithNull(), trueValue.replaceWithNull()]));
      return;
    }

    // Collapse partially-identical hook expressions
    if (falseValue.kind === Skew.NodeKind.HOOK) {
      var falseTest = falseValue.hookTest();
      var falseTrueValue = falseValue.hookTrue();
      var falseFalseValue = falseValue.hookFalse();

      // "a ? b : c ? b : d" => "a || c ? b : d"
      if (self.looksTheSame(trueValue, falseTrueValue)) {
        var or = Skew.Node.createBinary(Skew.NodeKind.LOGICAL_OR, new Skew.Node(Skew.NodeKind.NULL), falseTest.replaceWithNull());
        or.binaryLeft().replaceWith(test.replaceWith(or));
        falseValue.replaceWith(falseFalseValue.replaceWithNull());
        self.peepholeMangleHook(node);
        return;
      }
    }

    // Collapse partially-identical binary expressions
    if (trueValue.kind === falseValue.kind && Skew.NodeKind.isBinary(trueValue.kind)) {
      var trueLeft = trueValue.binaryLeft();
      var trueRight = trueValue.binaryRight();
      var falseLeft = falseValue.binaryLeft();
      var falseRight = falseValue.binaryRight();

      // "a ? b = c : b = d;" => "b = a ? c : d;"
      if (self.looksTheSame(trueLeft, falseLeft)) {
        var hook = Skew.Node.createHook(test.replaceWithNull(), trueRight.replaceWithNull(), falseRight.replaceWithNull());
        self.peepholeMangleHook(hook);
        node.become(Skew.Node.createBinary(trueValue.kind, trueLeft.replaceWithNull(), hook));
      }

      // "a ? b + 100 : c + 100;" => "(a ? b + c) + 100;"
      else if (self.looksTheSame(trueRight, falseRight) && !Skew.NodeKind.isBinaryAssign(trueValue.kind)) {
        var hook1 = Skew.Node.createHook(test.replaceWithNull(), trueLeft.replaceWithNull(), falseLeft.replaceWithNull());
        self.peepholeMangleHook(hook1);
        node.become(Skew.Node.createBinary(trueValue.kind, hook1, trueRight.replaceWithNull()));
      }
    }
  };

  Skew.JsEmitter.prototype.peepholeMangleBlock = function(node) {
    var self = this;
    var children = node.children;
    var i = 0;

    while (i < children.length) {
      var child = children[i];
      var kind = child.kind;

      // "a; b; c;" => "a, b, c;"
      if (kind === Skew.NodeKind.EXPRESSION) {
        while ((i + 1 | 0) < children.length) {
          var next = children[i + 1 | 0];

          if (next.kind !== Skew.NodeKind.EXPRESSION) {
            break;
          }

          var combined = Skew.Node.createExpression(self.joinExpressions(child.expressionValue().replaceWithNull(), next.remove().expressionValue().replaceWithNull()));
          child.replaceWith(combined);
          child = combined;
        }

        var value = child.expressionValue();

        if (value.kind === Skew.NodeKind.SEQUENCE) {
          self.peepholeMangleSequence(value);
        }
      }

      else if (kind === Skew.NodeKind.RETURN && child.returnValue() !== null) {
        while (i !== 0) {
          var previous = children[i - 1 | 0];

          // "if (a) return b; if (c) return d; return e;" => "return a ? b : c ? d : e;"
          if (previous.kind === Skew.NodeKind.IF && previous.ifFalse() === null) {
            var statement = previous.ifTrue().blockStatement();

            if (statement !== null && statement.kind === Skew.NodeKind.RETURN && statement.returnValue() !== null) {
              var hook = Skew.Node.createHook(previous.ifTest().replaceWithNull(), statement.returnValue().replaceWithNull(), child.returnValue().replaceWithNull());
              self.peepholeMangleHook(hook);
              child.remove();
              child = Skew.Node.createReturn(hook);
              previous.replaceWith(child);
            }

            else {
              break;
            }
          }

          else {
            break;
          }

          --i;
        }
      }

      ++i;
    }
  };

  Skew.JsEmitter.prototype.patchCast = function(node) {
    var self = this;
    var value = node.castValue();
    var type = node.resolvedType;
    var valueType = value.resolvedType;

    // Cast to bool
    if (type === self.cache.boolType) {
      if (valueType !== self.cache.boolType) {
        node.become(self.wrapWithNot(self.wrapWithNot(value.replaceWithNull())));
      }
    }

    // Cast to int
    else if (self.cache.isInteger(type)) {
      if (!self.cache.isInteger(valueType) && !Skew.JsEmitter.alwaysConvertsOperandsToInt(node.parent)) {
        node.become(self.wrapWithIntCast(value.replaceWithNull()));
      }
    }

    // Cast to double
    else if (type === self.cache.doubleType) {
      if (!self.cache.isNumeric(valueType)) {
        node.become(Skew.Node.createUnary(Skew.NodeKind.POSITIVE, value.replaceWithNull()).withRange(node.range).withType(self.cache.doubleType));
      }
    }

    // Cast to string
    else if (type === self.cache.stringType) {
      if (valueType !== self.cache.stringType) {
        node.become(Skew.Node.createBinary(Skew.NodeKind.ADD, value.replaceWithNull(), new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.StringContent("")).withType(self.cache.stringType)).withType(self.cache.stringType).withRange(node.range));
      }
    }
  };

  Skew.JsEmitter.isCompactNodeKind = function(kind) {
    return kind === Skew.NodeKind.EXPRESSION || kind === Skew.NodeKind.VAR || Skew.NodeKind.isJump(kind);
  };

  Skew.JsEmitter.isFalsy = function(node) {
    switch (node.kind) {
      case Skew.NodeKind.NULL: {
        return true;
      }

      case Skew.NodeKind.CAST: {
        return Skew.JsEmitter.isFalsy(node.castValue());
      }

      case Skew.NodeKind.CONSTANT: {
        var content = node.content;

        switch (content.kind()) {
          case Skew.ContentKind.INT: {
            return content.asInt() === 0;
          }

          case Skew.ContentKind.DOUBLE: {
            return content.asDouble() === 0 || isNaN(content.asDouble());
          }

          case Skew.ContentKind.STRING: {
            return content.asString() === "";
          }
        }
        break;
      }
    }

    return false;
  };

  Skew.JsEmitter.fullName = function(symbol) {
    var parent = symbol.parent;

    if (parent !== null && parent.kind !== Skew.SymbolKind.OBJECT_GLOBAL) {
      var enclosingName = Skew.JsEmitter.fullName(parent);

      if (symbol.isPrimaryConstructor()) {
        return enclosingName;
      }

      if (symbol.kind === Skew.SymbolKind.FUNCTION_INSTANCE) {
        enclosingName += ".prototype";
      }

      return enclosingName + "." + Skew.JsEmitter.mangleName(symbol);
    }

    return Skew.JsEmitter.mangleName(symbol);
  };

  Skew.JsEmitter.mangleName = function(symbol) {
    if (symbol.isPrimaryConstructor()) {
      symbol = symbol.parent;
    }

    if (!symbol.isImportedOrExported() && (symbol.name in Skew.JsEmitter.isKeyword || symbol.parent !== null && symbol.parent.kind === Skew.SymbolKind.OBJECT_CLASS && !Skew.SymbolKind.isOnInstances(symbol.kind) && symbol.name in Skew.JsEmitter.isFunctionProperty)) {
      return "$" + symbol.name;
    }

    return symbol.nameWithRenaming();
  };

  Skew.JsEmitter.needsExtends = function(objects) {
    for (var i = 0, list = objects, count = list.length; i < count; ++i) {
      var object = list[i];

      if (!object.isImported() && object.baseClass !== null) {
        return true;
      }
    }

    return false;
  };

  Skew.JsEmitter.computePrefix = function(symbol) {
    assert(Skew.SymbolKind.isObject(symbol.kind));
    return symbol.kind === Skew.SymbolKind.OBJECT_GLOBAL ? "" : Skew.JsEmitter.computePrefix(symbol.parent.asObjectSymbol()) + Skew.JsEmitter.mangleName(symbol) + ".";
  };

  Skew.JsEmitter.alwaysConvertsOperandsToInt = function(node) {
    if (node !== null) {
      switch (node.kind) {
        case Skew.NodeKind.ASSIGN_BITWISE_AND:
        case Skew.NodeKind.ASSIGN_BITWISE_OR:
        case Skew.NodeKind.ASSIGN_BITWISE_XOR:
        case Skew.NodeKind.ASSIGN_SHIFT_LEFT:
        case Skew.NodeKind.ASSIGN_SHIFT_RIGHT:
        case Skew.NodeKind.BITWISE_AND:
        case Skew.NodeKind.BITWISE_OR:
        case Skew.NodeKind.BITWISE_XOR:
        case Skew.NodeKind.COMPLEMENT:
        case Skew.NodeKind.SHIFT_LEFT:
        case Skew.NodeKind.SHIFT_RIGHT: {
          return true;
        }
      }
    }

    return false;
  };

  Skew.JsEmitter.AfterToken = {
    AFTER_KEYWORD: 0,
    AFTER_PARENTHESIS: 1
  };

  Skew.JsEmitter.BracesMode = {
    MUST_KEEP_BRACES: 0,
    CAN_OMIT_BRACES: 1
  };

  // These dump() functions are helpful for debugging syntax trees
  Skew.LispTreeEmitter = function(options) {
    var self = this;
    Skew.Emitter.call(self);
    self.options = options;
  };

  __extends(Skew.LispTreeEmitter, Skew.Emitter);

  Skew.LispTreeEmitter.prototype.visit = function(global) {
    var self = this;
    self.visitObject(global);
    self.emit("\n");
    self.createSource(self.options.outputDirectory !== "" ? self.options.outputDirectory + "/compiled.lisp" : self.options.outputFile);
  };

  Skew.LispTreeEmitter.prototype.visitObject = function(symbol) {
    var self = this;
    self.emit("(" + self.mangleKind(Skew.SymbolKind.strings[symbol.kind]) + " " + Skew.quoteString(symbol.name, 34));
    self.increaseIndent();

    for (var i = 0, list = symbol.objects, count = list.length; i < count; ++i) {
      var object = list[i];
      self.emit("\n" + self.indent);
      self.visitObject(object);
    }

    for (var i1 = 0, list1 = symbol.functions, count1 = list1.length; i1 < count1; ++i1) {
      var $function = list1[i1];
      self.emit("\n" + self.indent);
      self.visitFunction($function);
    }

    for (var i2 = 0, list2 = symbol.variables, count2 = list2.length; i2 < count2; ++i2) {
      var variable = list2[i2];
      self.emit("\n" + self.indent);
      self.visitVariable(variable);
    }

    self.decreaseIndent();
    self.emit(")");
  };

  Skew.LispTreeEmitter.prototype.visitFunction = function(symbol) {
    var self = this;
    self.emit("(" + self.mangleKind(Skew.SymbolKind.strings[symbol.kind]) + " " + Skew.quoteString(symbol.name, 34));
    self.increaseIndent();

    for (var i = 0, list = symbol.$arguments, count = list.length; i < count; ++i) {
      var argument = list[i];
      self.emit("\n" + self.indent);
      self.visitVariable(argument);
    }

    self.emit("\n" + self.indent);
    self.visitNode(symbol.returnType);
    self.emit("\n" + self.indent);
    self.visitNode(symbol.block);
    self.decreaseIndent();
    self.emit(")");
  };

  Skew.LispTreeEmitter.prototype.visitVariable = function(symbol) {
    var self = this;
    self.emit("(" + self.mangleKind(Skew.SymbolKind.strings[symbol.kind]) + " " + Skew.quoteString(symbol.name, 34) + " ");
    self.visitNode(symbol.type);
    self.emit(" ");
    self.visitNode(symbol.value);
    self.emit(")");
  };

  Skew.LispTreeEmitter.prototype.visitNode = function(node) {
    var self = this;

    if (node === null) {
      self.emit("nil");
      return;
    }

    self.emit("(" + self.mangleKind(Skew.NodeKind.strings[node.kind]));
    var content = node.content;

    if (content !== null) {
      switch (content.kind()) {
        case Skew.ContentKind.INT: {
          self.emit(" " + content.asInt().toString());
          break;
        }

        case Skew.ContentKind.BOOL: {
          self.emit(" " + content.asBool().toString());
          break;
        }

        case Skew.ContentKind.DOUBLE: {
          self.emit(" " + content.asDouble().toString());
          break;
        }

        case Skew.ContentKind.STRING: {
          self.emit(" " + Skew.quoteString(content.asString(), 34));
          break;
        }
      }
    }

    if (node.kind === Skew.NodeKind.VAR) {
      self.emit(" ");
      self.visitVariable(node.symbol.asVariableSymbol());
    }

    else if (node.kind === Skew.NodeKind.LAMBDA) {
      self.emit(" ");
      self.visitFunction(node.symbol.asFunctionSymbol());
    }

    else if (node.children !== null) {
      self.increaseIndent();

      for (var i = 0, list = node.children, count = list.length; i < count; ++i) {
        var child = list[i];
        self.emit("\n" + self.indent);
        self.visitNode(child);
      }

      self.decreaseIndent();
    }

    self.emit(")");
  };

  Skew.LispTreeEmitter.prototype.mangleKind = function(kind) {
    var self = this;
    return kind.toLowerCase().split("_").join("-");
  };

  Skew.ContentKind = {
    BOOL: 0,
    INT: 1,
    DOUBLE: 2,
    STRING: 3
  };

  Skew.Content = function() {
    var self = this;
  };

  Skew.Content.prototype.asBool = function() {
    var self = this;
    assert(self.kind() === Skew.ContentKind.BOOL);
    return self.value;
  };

  Skew.Content.prototype.asInt = function() {
    var self = this;
    assert(self.kind() === Skew.ContentKind.INT);
    return self.value;
  };

  Skew.Content.prototype.asDouble = function() {
    var self = this;
    assert(self.kind() === Skew.ContentKind.DOUBLE);
    return self.value;
  };

  Skew.Content.prototype.asString = function() {
    var self = this;
    assert(self.kind() === Skew.ContentKind.STRING);
    return self.value;
  };

  Skew.BoolContent = function(value) {
    var self = this;
    Skew.Content.call(self);
    self.value = value;
  };

  __extends(Skew.BoolContent, Skew.Content);

  Skew.BoolContent.prototype.kind = function() {
    var self = this;
    return Skew.ContentKind.BOOL;
  };

  Skew.IntContent = function(value) {
    var self = this;
    Skew.Content.call(self);
    self.value = value;
  };

  __extends(Skew.IntContent, Skew.Content);

  Skew.IntContent.prototype.kind = function() {
    var self = this;
    return Skew.ContentKind.INT;
  };

  Skew.DoubleContent = function(value) {
    var self = this;
    Skew.Content.call(self);
    self.value = value;
  };

  __extends(Skew.DoubleContent, Skew.Content);

  Skew.DoubleContent.prototype.kind = function() {
    var self = this;
    return Skew.ContentKind.DOUBLE;
  };

  Skew.StringContent = function(value) {
    var self = this;
    Skew.Content.call(self);
    self.value = value;
  };

  __extends(Skew.StringContent, Skew.Content);

  Skew.StringContent.prototype.kind = function() {
    var self = this;
    return Skew.ContentKind.STRING;
  };

  Skew.NodeKind = {
    // Other
    ANNOTATION: 0,
    BLOCK: 1,
    CASE: 2,
    CATCH: 3,

    // Statements
    BREAK: 4,
    CONTINUE: 5,
    EXPRESSION: 6,
    FOR: 7,
    FOREACH: 8,
    IF: 9,
    RETURN: 10,
    SWITCH: 11,
    THROW: 12,
    TRY: 13,
    VAR: 14,
    WHILE: 15,

    // Expressions
    ASSIGN_INDEX: 16,
    CALL: 17,
    CAST: 18,
    CONSTANT: 19,
    DOT: 20,
    DYNAMIC: 21,
    HOOK: 22,
    INDEX: 23,
    INITIALIZER_LIST: 24,
    INITIALIZER_MAP: 25,
    INITIALIZER_SET: 26,
    LAMBDA: 27,
    LAMBDA_TYPE: 28,
    NAME: 29,
    NULL: 30,
    PAIR: 31,
    PARAMETERIZE: 32,
    SEQUENCE: 33,
    SUPER: 34,
    TYPE: 35,

    // Unary operators
    COMPLEMENT: 36,
    DECREMENT: 37,
    INCREMENT: 38,
    NEGATIVE: 39,
    NOT: 40,
    POSITIVE: 41,

    // Binary operators
    ADD: 42,
    BITWISE_AND: 43,
    BITWISE_OR: 44,
    BITWISE_XOR: 45,
    COMPARE: 46,
    DIVIDE: 47,
    EQUAL: 48,
    IN: 49,
    IS: 50,
    LOGICAL_AND: 51,
    LOGICAL_OR: 52,
    MULTIPLY: 53,
    NOT_EQUAL: 54,
    POWER: 55,
    REMAINDER: 56,
    SHIFT_LEFT: 57,
    SHIFT_RIGHT: 58,
    SUBTRACT: 59,

    // Binary comparison operators
    GREATER_THAN: 60,
    GREATER_THAN_OR_EQUAL: 61,
    LESS_THAN: 62,
    LESS_THAN_OR_EQUAL: 63,

    // Binary assigment operators
    ASSIGN: 64,
    ASSIGN_ADD: 65,
    ASSIGN_BITWISE_AND: 66,
    ASSIGN_BITWISE_OR: 67,
    ASSIGN_BITWISE_XOR: 68,
    ASSIGN_DIVIDE: 69,
    ASSIGN_MULTIPLY: 70,
    ASSIGN_POWER: 71,
    ASSIGN_REMAINDER: 72,
    ASSIGN_SHIFT_LEFT: 73,
    ASSIGN_SHIFT_RIGHT: 74,
    ASSIGN_SUBTRACT: 75
  };

  Skew.NodeKind.isExpression = function(self) {
    return self >= Skew.NodeKind.ASSIGN_INDEX && self <= Skew.NodeKind.ASSIGN_SUBTRACT;
  };

  Skew.NodeKind.isInitializer = function(self) {
    return self >= Skew.NodeKind.INITIALIZER_LIST && self <= Skew.NodeKind.INITIALIZER_SET;
  };

  Skew.NodeKind.isUnary = function(self) {
    return self >= Skew.NodeKind.COMPLEMENT && self <= Skew.NodeKind.POSITIVE;
  };

  Skew.NodeKind.isUnaryAssign = function(self) {
    return self >= Skew.NodeKind.DECREMENT && self <= Skew.NodeKind.INCREMENT;
  };

  Skew.NodeKind.isBinary = function(self) {
    return self >= Skew.NodeKind.ADD && self <= Skew.NodeKind.ASSIGN_SUBTRACT;
  };

  Skew.NodeKind.isBinaryAssign = function(self) {
    return self >= Skew.NodeKind.ASSIGN && self <= Skew.NodeKind.ASSIGN_SUBTRACT;
  };

  Skew.NodeKind.isBinaryComparison = function(self) {
    return self >= Skew.NodeKind.GREATER_THAN && self <= Skew.NodeKind.LESS_THAN_OR_EQUAL;
  };

  Skew.NodeKind.isJump = function(self) {
    return self === Skew.NodeKind.BREAK || self === Skew.NodeKind.CONTINUE || self === Skew.NodeKind.RETURN;
  };

  Skew.NodeKind.isAssign = function(self) {
    return Skew.NodeKind.isUnaryAssign(self) || Skew.NodeKind.isBinaryAssign(self);
  };

  // Flags
  // Nodes represent executable code (variable initializers and function bodies)
  // Node-specific queries
  // Factory functions
  // Getters
  Skew.Node = function(kind) {
    var self = this;
    self.kind = kind;
    self.flags = 0;
    self.range = null;
    self.internalRange = null;
    self.symbol = null;
    self.parent = null;
    self.content = null;
    self.resolvedType = null;
    self.comments = null;
    self.children = null;
  };

  // Change self node in place to become the provided node. The parent node is
  // not changed, so become() can be called within a nested method and does not
  // need to report the updated node reference to the caller since the reference
  // does not change.
  Skew.Node.prototype.become = function(node) {
    var self = this;
    self.kind = node.kind;
    self.flags = node.flags;
    self.range = node.range;
    self.internalRange = node.internalRange;
    self.symbol = node.symbol;
    self.content = node.content;
    self.resolvedType = node.resolvedType;
    self.comments = node.comments;
    self.removeChildren();
    self.withChildren(node.removeChildren());
  };

  Skew.Node.prototype.clone = function() {
    var self = this;

    // Lambda symbols reference their block, which will not get cloned
    assert(self.kind !== Skew.NodeKind.LAMBDA);
    var clone = new Skew.Node(self.kind);
    clone.flags = self.flags;
    clone.range = self.range;
    clone.internalRange = self.internalRange;
    clone.symbol = self.symbol;
    clone.content = self.content;
    clone.resolvedType = self.resolvedType;
    clone.comments = self.comments !== null ? self.comments.slice() : null;

    if (self.children !== null) {
      var clones = [];

      for (var i = 0, list = self.children, count = list.length; i < count; ++i) {
        var child = list[i];
        clones.push(child.clone());
      }

      clone.withChildren(clones);
    }

    return clone;
  };

  Skew.Node.prototype.isImplicitReturn = function() {
    var self = this;
    return (self.flags & Skew.Node.IS_IMPLICIT_RETURN) !== 0;
  };

  Skew.Node.prototype.isInsideParentheses = function() {
    var self = this;
    return (self.flags & Skew.Node.IS_INSIDE_PARENTHESES) !== 0;
  };

  Skew.Node.prototype.hasChildren = function() {
    var self = this;
    return self.children !== null && !(self.children.length === 0);
  };

  Skew.Node.prototype.withFlags = function(value) {
    var self = this;
    self.flags = value;
    return self;
  };

  Skew.Node.prototype.withType = function(value) {
    var self = this;
    self.resolvedType = value;
    return self;
  };

  Skew.Node.prototype.withSymbol = function(value) {
    var self = this;
    self.symbol = value;
    return self;
  };

  Skew.Node.prototype.withContent = function(value) {
    var self = this;
    self.content = value;
    return self;
  };

  Skew.Node.prototype.withRange = function(value) {
    var self = this;
    self.range = value;
    return self;
  };

  Skew.Node.prototype.withInternalRange = function(value) {
    var self = this;
    self.internalRange = value;
    return self;
  };

  Skew.Node.prototype.withChildren = function(nodes) {
    var self = this;
    assert(self.children === null);

    if (nodes !== null) {
      for (var i = 0, list = nodes, count = list.length; i < count; ++i) {
        var node = list[i];
        Skew.Node.updateParent(node, self);
      }
    }

    self.children = nodes;
    return self;
  };

  Skew.Node.prototype.withComments = function(value) {
    var self = this;
    assert(self.comments === null);
    self.comments = value;
    return self;
  };

  Skew.Node.prototype.internalRangeOrRange = function() {
    var self = this;
    return self.internalRange !== null ? self.internalRange : self.range;
  };

  Skew.Node.prototype.indexInParent = function() {
    var self = this;
    assert(self.parent !== null);
    return self.parent.children.indexOf(self);
  };

  Skew.Node.prototype.insertChild = function(index, node) {
    var self = this;

    if (self.children === null) {
      self.children = [];
    }

    assert(index >= 0 && index <= self.children.length);
    Skew.Node.updateParent(node, self);
    self.children.splice(index, 0, node);
  };

  Skew.Node.prototype.insertChildren = function(index, nodes) {
    var self = this;

    if (self.children === null) {
      self.children = [];
    }

    assert(index >= 0 && index <= self.children.length);

    for (var i = 0, list = nodes, count = list.length; i < count; ++i) {
      var node = list[i];
      Skew.Node.updateParent(node, self);
      self.children.splice(index, 0, node);
      ++index;
    }
  };

  Skew.Node.prototype.appendChild = function(node) {
    var self = this;
    self.insertChild(self.children === null ? 0 : self.children.length, node);
  };

  Skew.Node.prototype.appendChildren = function(nodes) {
    var self = this;
    self.insertChildren(self.children === null ? 0 : self.children.length, nodes);
  };

  Skew.Node.prototype.removeChildAtIndex = function(index) {
    var self = this;
    assert(index >= 0 && index < self.children.length);
    var child = self.children[index];
    Skew.Node.updateParent(child, null);
    self.children.splice(index, 1);
    return child;
  };

  Skew.Node.prototype.remove = function() {
    var self = this;
    self.parent.removeChildAtIndex(self.indexInParent());
    return self;
  };

  Skew.Node.prototype.removeChildren = function() {
    var self = this;
    var result = self.children;

    if (result !== null) {
      for (var i = 0, list = result, count = list.length; i < count; ++i) {
        var child = list[i];
        Skew.Node.updateParent(child, null);
      }

      self.children = null;
    }

    return result;
  };

  Skew.Node.prototype.replaceWithNodes = function(nodes) {
    var self = this;
    var index = self.indexInParent();

    for (var i = 0, count = nodes.length; i < count; ++i) {
      self.parent.insertChild((index + i | 0) + 1 | 0, nodes[i]);
    }

    self.parent.removeChildAtIndex(index);
    return self;
  };

  Skew.Node.prototype.replaceChild = function(index, node) {
    var self = this;
    assert(index >= 0 && index < self.children.length);
    Skew.Node.updateParent(node, self);
    var child = self.children[index];
    Skew.Node.updateParent(child, null);
    self.children[index] = node;
    return child;
  };

  Skew.Node.prototype.replaceWith = function(node) {
    var self = this;
    self.parent.replaceChild(self.indexInParent(), node);
    return self;
  };

  Skew.Node.prototype.replaceWithNull = function() {
    var self = this;
    self.parent.replaceChild(self.indexInParent(), null);
    return self;
  };

  Skew.Node.prototype.swapWith = function(node) {
    var self = this;
    var parentA = self.parent;
    var parentB = node.parent;
    var indexA = self.indexInParent();
    var indexB = node.indexInParent();
    parentA.children[indexA] = node;
    parentB.children[indexB] = self;
    self.parent = parentB;
    node.parent = parentA;
  };

  Skew.Node.updateParent = function(node, parent) {
    if (node !== null) {
      assert(node.parent === null !== (parent === null));
      node.parent = parent;
    }
  };

  Skew.Node.prototype.isTrue = function() {
    var self = this;
    return self.kind === Skew.NodeKind.CONSTANT && self.content.kind() === Skew.ContentKind.BOOL && self.content.asBool();
  };

  Skew.Node.prototype.isFalse = function() {
    var self = this;
    return self.kind === Skew.NodeKind.CONSTANT && self.content.kind() === Skew.ContentKind.BOOL && !self.content.asBool();
  };

  Skew.Node.prototype.isType = function() {
    var self = this;
    return self.kind === Skew.NodeKind.TYPE || self.kind === Skew.NodeKind.LAMBDA_TYPE || (self.kind === Skew.NodeKind.NAME || self.kind === Skew.NodeKind.DOT || self.kind === Skew.NodeKind.PARAMETERIZE) && self.symbol !== null && Skew.SymbolKind.isType(self.symbol.kind);
  };

  Skew.Node.prototype.isAssignTarget = function() {
    var self = this;
    return self.parent !== null && (Skew.NodeKind.isUnaryAssign(self.parent.kind) || Skew.NodeKind.isBinaryAssign(self.parent.kind) && self === self.parent.binaryLeft());
  };

  Skew.Node.prototype.isNumberLessThanZero = function() {
    var self = this;
    return self.isInt() && self.asInt() < 0 || self.isDouble() && self.asDouble() < 0;
  };

  Skew.Node.prototype.blockAlwaysEndsWithReturn = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.BLOCK);

    // This checks children in reverse since return statements are almost always last
    for (var i = 0, count = self.children.length; i < count; ++i) {
      var child = self.children[(self.children.length - i | 0) - 1 | 0];

      switch (child.kind) {
        case Skew.NodeKind.RETURN: {
          return true;
        }

        case Skew.NodeKind.IF: {
          var test = child.ifTest();
          var trueBlock = child.ifTrue();
          var falseBlock = child.ifFalse();

          if ((test.isTrue() || falseBlock !== null && falseBlock.blockAlwaysEndsWithReturn()) && (test.isFalse() || trueBlock.blockAlwaysEndsWithReturn())) {
            return true;
          }
          break;
        }

        case Skew.NodeKind.WHILE: {
          if (child.whileTest().isTrue()) {
            return true;
          }
          break;
        }
      }
    }

    return false;
  };

  Skew.Node.prototype.hasNoSideEffects = function() {
    var self = this;
    assert(Skew.NodeKind.isExpression(self.kind));

    switch (self.kind) {
      case Skew.NodeKind.NAME:
      case Skew.NodeKind.CONSTANT:
      case Skew.NodeKind.NULL: {
        return true;
      }

      case Skew.NodeKind.CAST: {
        return self.castValue().hasNoSideEffects();
      }

      case Skew.NodeKind.HOOK: {
        return self.hookTest().hasNoSideEffects() && self.hookTrue().hasNoSideEffects() && self.hookFalse().hasNoSideEffects();
      }

      case Skew.NodeKind.DOT: {
        return self.dotTarget().hasNoSideEffects();
      }

      default: {
        if (Skew.NodeKind.isBinary(self.kind)) {
          return !Skew.NodeKind.isBinaryAssign(self.kind) && self.binaryLeft().hasNoSideEffects() && self.binaryRight().hasNoSideEffects();
        }

        if (Skew.NodeKind.isUnary(self.kind)) {
          return !Skew.NodeKind.isUnaryAssign(self.kind) && self.unaryValue().hasNoSideEffects();
        }
        break;
      }
    }

    return false;
  };

  Skew.Node.prototype.invertBooleanCondition = function(cache) {
    var self = this;
    assert(Skew.NodeKind.isExpression(self.kind));

    switch (self.kind) {
      case Skew.NodeKind.CONSTANT: {
        if (self.content.kind() === Skew.ContentKind.BOOL) {
          self.content = new Skew.BoolContent(!self.content.asBool());
        }

        return;
      }

      case Skew.NodeKind.NOT: {
        self.become(self.unaryValue().remove());
        return;
      }

      case Skew.NodeKind.EQUAL: {
        self.kind = Skew.NodeKind.NOT_EQUAL;
        return;
      }

      case Skew.NodeKind.NOT_EQUAL: {
        self.kind = Skew.NodeKind.EQUAL;
        return;
      }

      case Skew.NodeKind.LOGICAL_OR: {
        self.kind = Skew.NodeKind.LOGICAL_AND;
        self.binaryLeft().invertBooleanCondition(cache);
        self.binaryRight().invertBooleanCondition(cache);
        return;
      }

      case Skew.NodeKind.LOGICAL_AND: {
        self.kind = Skew.NodeKind.LOGICAL_OR;
        self.binaryLeft().invertBooleanCondition(cache);
        self.binaryRight().invertBooleanCondition(cache);
        return;
      }

      case Skew.NodeKind.LESS_THAN:
      case Skew.NodeKind.GREATER_THAN:
      case Skew.NodeKind.LESS_THAN_OR_EQUAL:
      case Skew.NodeKind.GREATER_THAN_OR_EQUAL: {
        var commonType = cache.commonImplicitType(self.binaryLeft().resolvedType, self.binaryRight().resolvedType);

        if (commonType !== null && commonType !== cache.doubleType) {
          switch (self.kind) {
            case Skew.NodeKind.LESS_THAN: {
              self.kind = Skew.NodeKind.GREATER_THAN_OR_EQUAL;
              break;
            }

            case Skew.NodeKind.GREATER_THAN: {
              self.kind = Skew.NodeKind.LESS_THAN_OR_EQUAL;
              break;
            }

            case Skew.NodeKind.LESS_THAN_OR_EQUAL: {
              self.kind = Skew.NodeKind.GREATER_THAN;
              break;
            }

            case Skew.NodeKind.GREATER_THAN_OR_EQUAL: {
              self.kind = Skew.NodeKind.LESS_THAN;
              break;
            }
          }

          return;
        }
        break;
      }
    }

    // Remove children before clone() so they are moved instead of copied
    var children = self.removeChildren();
    self.become(Skew.Node.createUnary(Skew.NodeKind.NOT, self.clone().withChildren(children)).withType(cache.boolType));
  };

  Skew.Node.createAnnotation = function(value, test) {
    assert(Skew.NodeKind.isExpression(value.kind));
    assert(test === null || Skew.NodeKind.isExpression(test.kind));
    return new Skew.Node(Skew.NodeKind.ANNOTATION).withChildren([value, test]);
  };

  Skew.Node.createCase = function(values, block) {
    assert(block.kind === Skew.NodeKind.BLOCK);
    values.unshift(block);
    return new Skew.Node(Skew.NodeKind.CASE).withChildren(values);
  };

  Skew.Node.createCatch = function(symbol, block) {
    assert(block.kind === Skew.NodeKind.BLOCK);
    return new Skew.Node(Skew.NodeKind.CATCH).withChildren([block]).withSymbol(symbol);
  };

  Skew.Node.createExpression = function(value) {
    assert(Skew.NodeKind.isExpression(value.kind));
    return new Skew.Node(Skew.NodeKind.EXPRESSION).withChildren([value]);
  };

  Skew.Node.createFor = function(setup, test, update, block) {
    assert(test === null || Skew.NodeKind.isExpression(test.kind));
    assert(update === null || Skew.NodeKind.isExpression(update.kind));
    assert(block.kind === Skew.NodeKind.BLOCK);
    in_List.prepend2(setup, [test, update, block]);
    return new Skew.Node(Skew.NodeKind.FOR).withChildren(setup);
  };

  Skew.Node.createForeach = function(symbol, value, block) {
    assert(Skew.NodeKind.isExpression(value.kind));
    assert(block.kind === Skew.NodeKind.BLOCK);
    return new Skew.Node(Skew.NodeKind.FOREACH).withSymbol(symbol).withChildren([value, block]);
  };

  Skew.Node.createIf = function(test, trueBlock, falseBlock) {
    assert(Skew.NodeKind.isExpression(test.kind));
    assert(trueBlock.kind === Skew.NodeKind.BLOCK);
    assert(falseBlock === null || falseBlock.kind === Skew.NodeKind.BLOCK);
    return new Skew.Node(Skew.NodeKind.IF).withChildren([test, trueBlock, falseBlock]);
  };

  Skew.Node.createReturn = function(value) {
    assert(value === null || Skew.NodeKind.isExpression(value.kind));
    return new Skew.Node(Skew.NodeKind.RETURN).withChildren([value]);
  };

  Skew.Node.createSwitch = function(value, cases) {
    assert(Skew.NodeKind.isExpression(value.kind));
    cases.unshift(value);
    return new Skew.Node(Skew.NodeKind.SWITCH).withChildren(cases);
  };

  Skew.Node.createThrow = function(value) {
    assert(Skew.NodeKind.isExpression(value.kind));
    return new Skew.Node(Skew.NodeKind.THROW).withChildren([value]);
  };

  Skew.Node.createTry = function(tryBlock, catches, finallyBlock) {
    assert(tryBlock.kind === Skew.NodeKind.BLOCK);
    assert(finallyBlock === null || finallyBlock.kind === Skew.NodeKind.BLOCK);
    catches.unshift(tryBlock);
    catches.push(finallyBlock);
    return new Skew.Node(Skew.NodeKind.TRY).withChildren(catches);
  };

  // This adds the initializer expression to the tree for ease of traversal
  Skew.Node.createVar = function(symbol) {
    return new Skew.Node(Skew.NodeKind.VAR).withChildren([symbol.value]).withSymbol(symbol);
  };

  Skew.Node.createIndex = function(target, $arguments) {
    assert(Skew.NodeKind.isExpression(target.kind));
    $arguments.unshift(target);
    return new Skew.Node(Skew.NodeKind.INDEX).withChildren($arguments);
  };

  Skew.Node.createCall = function(target, $arguments) {
    assert(Skew.NodeKind.isExpression(target.kind));
    $arguments.unshift(target);
    return new Skew.Node(Skew.NodeKind.CALL).withChildren($arguments);
  };

  Skew.Node.createCast = function(value, type) {
    assert(Skew.NodeKind.isExpression(value.kind));
    assert(Skew.NodeKind.isExpression(type.kind));
    return new Skew.Node(Skew.NodeKind.CAST).withChildren([value, type]);
  };

  Skew.Node.createHook = function(test, trueValue, falseValue) {
    assert(Skew.NodeKind.isExpression(test.kind));
    assert(Skew.NodeKind.isExpression(trueValue.kind));
    assert(Skew.NodeKind.isExpression(falseValue.kind));
    return new Skew.Node(Skew.NodeKind.HOOK).withChildren([test, trueValue, falseValue]);
  };

  Skew.Node.createInitializer = function(kind, values) {
    assert(Skew.NodeKind.isInitializer(kind));
    return new Skew.Node(kind).withChildren(values);
  };

  // This adds the block to the tree for ease of traversal
  Skew.Node.createLambda = function(symbol) {
    return new Skew.Node(Skew.NodeKind.LAMBDA).withChildren([symbol.block]).withSymbol(symbol);
  };

  Skew.Node.createPair = function(first, second) {
    assert(Skew.NodeKind.isExpression(first.kind));
    assert(Skew.NodeKind.isExpression(second.kind));
    return new Skew.Node(Skew.NodeKind.PAIR).withChildren([first, second]);
  };

  Skew.Node.createParameterize = function(type, parameters) {
    assert(Skew.NodeKind.isExpression(type.kind));
    parameters.unshift(type);
    return new Skew.Node(Skew.NodeKind.PARAMETERIZE).withChildren(parameters);
  };

  Skew.Node.createUnary = function(kind, value) {
    assert(Skew.NodeKind.isUnary(kind));
    assert(Skew.NodeKind.isExpression(value.kind));
    return new Skew.Node(kind).withChildren([value]);
  };

  Skew.Node.createBinary = function(kind, left, right) {
    assert(Skew.NodeKind.isBinary(kind));
    assert(Skew.NodeKind.isExpression(left.kind));
    assert(Skew.NodeKind.isExpression(right.kind));
    return new Skew.Node(kind).withChildren([left, right]);
  };

  Skew.Node.createLambdaType = function(argTypes, returnType) {
    argTypes.push(returnType);
    return new Skew.Node(Skew.NodeKind.LAMBDA_TYPE).withChildren(argTypes);
  };

  Skew.Node.prototype.isInt = function() {
    var self = this;
    return self.kind === Skew.NodeKind.CONSTANT && self.content.kind() === Skew.ContentKind.INT;
  };

  Skew.Node.prototype.isBool = function() {
    var self = this;
    return self.kind === Skew.NodeKind.CONSTANT && self.content.kind() === Skew.ContentKind.BOOL;
  };

  Skew.Node.prototype.isDouble = function() {
    var self = this;
    return self.kind === Skew.NodeKind.CONSTANT && self.content.kind() === Skew.ContentKind.DOUBLE;
  };

  Skew.Node.prototype.isString = function() {
    var self = this;
    return self.kind === Skew.NodeKind.CONSTANT && self.content.kind() === Skew.ContentKind.STRING;
  };

  Skew.Node.prototype.asInt = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.CONSTANT);
    return self.content.asInt();
  };

  Skew.Node.prototype.asBool = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.CONSTANT);
    return self.content.asBool();
  };

  Skew.Node.prototype.asDouble = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.CONSTANT);
    return self.content.asDouble();
  };

  Skew.Node.prototype.asString = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.NAME || self.kind === Skew.NodeKind.DOT || self.kind === Skew.NodeKind.CONSTANT);
    return self.content.asString();
  };

  Skew.Node.prototype.blockStatement = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.BLOCK);
    return self.children.length === 1 ? self.children[0] : null;
  };

  Skew.Node.prototype.firstValue = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.PAIR);
    assert(self.children.length === 2);
    assert(Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.secondValue = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.PAIR);
    assert(self.children.length === 2);
    assert(Skew.NodeKind.isExpression(self.children[1].kind));
    return self.children[1];
  };

  Skew.Node.prototype.dotTarget = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.DOT);
    assert(self.children.length === 1);
    assert(self.children[0] === null || Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.annotationValue = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.ANNOTATION);
    assert(self.children.length === 2);
    assert(Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.annotationTest = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.ANNOTATION);
    assert(self.children.length === 2);
    assert(self.children[1] === null || Skew.NodeKind.isExpression(self.children[1].kind));
    return self.children[1];
  };

  Skew.Node.prototype.caseBlock = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.CASE);
    assert(self.children.length >= 1);
    assert(self.children[0].kind === Skew.NodeKind.BLOCK);
    return self.children[0];
  };

  Skew.Node.prototype.catchBlock = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.CATCH);
    assert(self.children.length === 1);
    assert(self.children[0].kind === Skew.NodeKind.BLOCK);
    return self.children[0];
  };

  Skew.Node.prototype.expressionValue = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.EXPRESSION);
    assert(self.children.length === 1);
    assert(Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.returnValue = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.RETURN);
    assert(self.children.length === 1);
    assert(self.children[0] === null || Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.switchValue = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.SWITCH);
    assert(self.children.length >= 1);
    assert(Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.parameterizeValue = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.PARAMETERIZE);
    assert(self.children.length >= 1);
    assert(Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.callValue = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.CALL);
    assert(self.children.length >= 1);
    assert(Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.castValue = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.CAST);
    assert(self.children.length === 2);
    assert(Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.castType = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.CAST);
    assert(self.children.length === 2);
    assert(Skew.NodeKind.isExpression(self.children[1].kind));
    return self.children[1];
  };

  Skew.Node.prototype.unaryValue = function() {
    var self = this;
    assert(Skew.NodeKind.isUnary(self.kind));
    assert(self.children.length === 1);
    assert(Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.binaryLeft = function() {
    var self = this;
    assert(Skew.NodeKind.isBinary(self.kind));
    assert(self.children.length === 2);
    assert(Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.binaryRight = function() {
    var self = this;
    assert(Skew.NodeKind.isBinary(self.kind));
    assert(self.children.length === 2);
    assert(Skew.NodeKind.isExpression(self.children[1].kind));
    return self.children[1];
  };

  Skew.Node.prototype.throwValue = function() {
    var self = this;
    assert(self.children.length === 1);
    assert(Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.tryBlock = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.TRY);
    assert(self.children.length >= 2);
    assert(self.children[0].kind === Skew.NodeKind.BLOCK);
    return self.children[0];
  };

  Skew.Node.prototype.finallyBlock = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.TRY);
    assert(self.children.length >= 2);
    assert(in_List.last(self.children) === null || in_List.last(self.children).kind === Skew.NodeKind.BLOCK);
    return in_List.last(self.children);
  };

  Skew.Node.prototype.whileTest = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.WHILE);
    assert(self.children.length === 2);
    assert(Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.whileBlock = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.WHILE);
    assert(self.children.length === 2);
    assert(self.children[1].kind === Skew.NodeKind.BLOCK);
    return self.children[1];
  };

  Skew.Node.prototype.forTest = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.FOR);
    assert(self.children.length >= 3);
    assert(self.children[0] === null || Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.forUpdate = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.FOR);
    assert(self.children.length >= 3);
    assert(self.children[1] === null || Skew.NodeKind.isExpression(self.children[1].kind));
    return self.children[1];
  };

  Skew.Node.prototype.forBlock = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.FOR);
    assert(self.children.length >= 3);
    assert(self.children[2].kind === Skew.NodeKind.BLOCK);
    return self.children[2];
  };

  Skew.Node.prototype.foreachValue = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.FOREACH);
    assert(self.children.length === 2);
    assert(Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.foreachBlock = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.FOREACH);
    assert(self.children.length === 2);
    assert(self.children[1].kind === Skew.NodeKind.BLOCK);
    return self.children[1];
  };

  Skew.Node.prototype.ifTest = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.IF);
    assert(self.children.length === 3);
    assert(Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.ifTrue = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.IF);
    assert(self.children.length === 3);
    assert(self.children[1].kind === Skew.NodeKind.BLOCK);
    return self.children[1];
  };

  Skew.Node.prototype.ifFalse = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.IF);
    assert(self.children.length === 3);
    assert(self.children[2] === null || self.children[2].kind === Skew.NodeKind.BLOCK);
    return self.children[2];
  };

  Skew.Node.prototype.hookTest = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.HOOK);
    assert(self.children.length === 3);
    assert(Skew.NodeKind.isExpression(self.children[0].kind));
    return self.children[0];
  };

  Skew.Node.prototype.hookTrue = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.HOOK);
    assert(self.children.length === 3);
    assert(Skew.NodeKind.isExpression(self.children[1].kind));
    return self.children[1];
  };

  Skew.Node.prototype.hookFalse = function() {
    var self = this;
    assert(self.kind === Skew.NodeKind.HOOK);
    assert(self.children.length === 3);
    assert(Skew.NodeKind.isExpression(self.children[2].kind));
    return self.children[2];
  };

  Skew.OperatorInfo = function(text, precedence, associativity, kind, count) {
    var self = this;
    self.text = text;
    self.precedence = precedence;
    self.associativity = associativity;
    self.kind = kind;
    self.count = count;
  };

  Skew.ArgumentCount = {
    ONE: 0,
    ONE_OR_MORE: 1,
    ONE_OR_TWO: 2,
    TWO_OR_FEWER: 3,
    TWO_OR_MORE: 4,
    ZERO: 5,
    ZERO_OR_MORE: 6,
    ZERO_OR_ONE: 7
  };

  Skew.OperatorKind = {
    FIXED: 0,
    OVERRIDABLE: 1
  };

  Skew.UnionFind = function() {
    var self = this;
    self.parents = [];
  };

  Skew.UnionFind.prototype.allocate1 = function() {
    var self = this;
    var index = self.parents.length;
    self.parents.push(index);
    return index;
  };

  Skew.UnionFind.prototype.allocate2 = function(count) {
    var self = this;

    for (var i = 0, count1 = count; i < count1; ++i) {
      self.parents.push(self.parents.length);
    }

    return self;
  };

  Skew.UnionFind.prototype.union = function(left, right) {
    var self = this;
    self.parents[self.find(left)] = self.find(right);
  };

  Skew.UnionFind.prototype.find = function(index) {
    var self = this;
    assert(index >= 0 && index < self.parents.length);
    var parent = self.parents[index];

    if (parent !== index) {
      parent = self.find(parent);
      self.parents[index] = parent;
    }

    return parent;
  };

  Skew.PrettyPrint = {};

  Skew.PrettyPrint.join = function(parts, trailing) {
    if (parts.length < 3) {
      return parts.join(" " + trailing + " ");
    }

    var text = "";

    for (var i = 0, count = parts.length; i < count; ++i) {
      if (i !== 0) {
        text += ", ";

        if ((i + 1 | 0) === parts.length) {
          text += trailing + " ";
        }
      }

      text += parts[i];
    }

    return text;
  };

  Skew.PrettyPrint.wrapWords = function(text, width) {
    // An invalid length means wrapping is disabled
    if (width < 1) {
      return [text];
    }

    var words = text.split(" ");
    var lines = [];
    var line = "";

    // Run the word wrapping algorithm
    var i = 0;

    while (i < words.length) {
      var word = words[i];
      var lineLength = line.length;
      var wordLength = word.length;
      var estimatedLength = (lineLength + 1 | 0) + wordLength | 0;
      ++i;

      // Collapse adjacent spaces
      if (word === "") {
        continue;
      }

      // Start the line
      if (line === "") {
        while (word.length > width) {
          lines.push(word.slice(0, width));
          word = word.slice(width, word.length);
        }

        line = word;
      }

      // Continue line
      else if (estimatedLength < width) {
        line += " " + word;
      }

      // Continue and wrap
      else if (estimatedLength === width) {
        lines.push(line + " " + word);
        line = "";
      }

      // Wrap and try again
      else {
        lines.push(line);
        line = "";
        --i;
      }
    }

    // Don't add an empty trailing line unless there are no other lines
    if (line !== "" || lines.length === 0) {
      lines.push(line);
    }

    return lines;
  };

  Skew.SymbolKind = {
    PARAMETER_FUNCTION: 0,
    PARAMETER_OBJECT: 1,
    OBJECT_CLASS: 2,
    OBJECT_ENUM: 3,
    OBJECT_GLOBAL: 4,
    OBJECT_INTERFACE: 5,
    OBJECT_NAMESPACE: 6,
    FUNCTION_ANNOTATION: 7,
    FUNCTION_CONSTRUCTOR: 8,
    FUNCTION_GLOBAL: 9,
    FUNCTION_INSTANCE: 10,
    FUNCTION_LOCAL: 11,
    OVERLOADED_ANNOTATION: 12,
    OVERLOADED_GLOBAL: 13,
    OVERLOADED_INSTANCE: 14,
    VARIABLE_ENUM: 15,
    VARIABLE_GLOBAL: 16,
    VARIABLE_INSTANCE: 17,
    VARIABLE_LOCAL: 18
  };

  Skew.SymbolKind.isType = function(self) {
    return self >= Skew.SymbolKind.PARAMETER_FUNCTION && self <= Skew.SymbolKind.OBJECT_NAMESPACE;
  };

  Skew.SymbolKind.isParameter = function(self) {
    return self >= Skew.SymbolKind.PARAMETER_FUNCTION && self <= Skew.SymbolKind.PARAMETER_OBJECT;
  };

  Skew.SymbolKind.isObject = function(self) {
    return self >= Skew.SymbolKind.OBJECT_CLASS && self <= Skew.SymbolKind.OBJECT_NAMESPACE;
  };

  Skew.SymbolKind.isFunction = function(self) {
    return self >= Skew.SymbolKind.FUNCTION_ANNOTATION && self <= Skew.SymbolKind.FUNCTION_LOCAL;
  };

  Skew.SymbolKind.isOverloadedFunction = function(self) {
    return self >= Skew.SymbolKind.OVERLOADED_ANNOTATION && self <= Skew.SymbolKind.OVERLOADED_INSTANCE;
  };

  Skew.SymbolKind.isFunctionOrOverloadedFunction = function(self) {
    return self >= Skew.SymbolKind.FUNCTION_ANNOTATION && self <= Skew.SymbolKind.OVERLOADED_INSTANCE;
  };

  Skew.SymbolKind.isVariable = function(self) {
    return self >= Skew.SymbolKind.VARIABLE_ENUM && self <= Skew.SymbolKind.VARIABLE_LOCAL;
  };

  Skew.SymbolKind.isGlobalReference = function(self) {
    return self === Skew.SymbolKind.VARIABLE_ENUM || self === Skew.SymbolKind.VARIABLE_GLOBAL || self === Skew.SymbolKind.FUNCTION_GLOBAL || self === Skew.SymbolKind.FUNCTION_CONSTRUCTOR || self === Skew.SymbolKind.OVERLOADED_GLOBAL || Skew.SymbolKind.isType(self);
  };

  Skew.SymbolKind.hasInstances = function(self) {
    return self === Skew.SymbolKind.OBJECT_CLASS || self === Skew.SymbolKind.OBJECT_ENUM || self === Skew.SymbolKind.OBJECT_INTERFACE;
  };

  Skew.SymbolKind.isOnInstances = function(self) {
    return self === Skew.SymbolKind.FUNCTION_INSTANCE || self === Skew.SymbolKind.VARIABLE_INSTANCE || self === Skew.SymbolKind.OVERLOADED_INSTANCE;
  };

  Skew.SymbolKind.isLocal = function(self) {
    return self === Skew.SymbolKind.FUNCTION_LOCAL || self === Skew.SymbolKind.VARIABLE_LOCAL;
  };

  Skew.SymbolState = {
    UNINITIALIZED: 0,
    INITIALIZING: 1,
    INITIALIZED: 2
  };

  Skew.Symbol = function(kind, name) {
    var self = this;
    self.id = Skew.Symbol.createID();
    self.kind = kind;
    self.name = name;
    self.range = null;
    self.parent = null;
    self.resolvedType = null;
    self.scope = null;
    self.state = Skew.SymbolState.UNINITIALIZED;
    self.annotations = null;
    self.comments = null;
    self.flags = 0;
  };

  // Flags
  Skew.Symbol.prototype.isAutomaticallyGenerated = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_AUTOMATICALLY_GENERATED) !== 0;
  };

  Skew.Symbol.prototype.isConst = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_CONST) !== 0;
  };

  Skew.Symbol.prototype.isGetter = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_GETTER) !== 0;
  };

  Skew.Symbol.prototype.isLoopVariable = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_LOOP_VARIABLE) !== 0;
  };

  Skew.Symbol.prototype.isOver = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_OVER) !== 0;
  };

  Skew.Symbol.prototype.isSetter = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_SETTER) !== 0;
  };

  Skew.Symbol.prototype.isValueType = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_VALUE_TYPE) !== 0;
  };

  Skew.Symbol.prototype.shouldInferReturnType = function() {
    var self = this;
    return (self.flags & Skew.Symbol.SHOULD_INFER_RETURN_TYPE) !== 0;
  };

  // Modifiers
  Skew.Symbol.prototype.isDeprecated = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_DEPRECATED) !== 0;
  };

  Skew.Symbol.prototype.isEntryPoint = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_ENTRY_POINT) !== 0;
  };

  Skew.Symbol.prototype.isExported = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_EXPORTED) !== 0;
  };

  Skew.Symbol.prototype.isImported = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_IMPORTED) !== 0;
  };

  Skew.Symbol.prototype.isPreferred = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_PREFERRED) !== 0;
  };

  Skew.Symbol.prototype.isPrivate = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_PRIVATE) !== 0;
  };

  Skew.Symbol.prototype.isProtected = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_PROTECTED) !== 0;
  };

  Skew.Symbol.prototype.isRenamed = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_RENAMED) !== 0;
  };

  Skew.Symbol.prototype.isSkipped = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_SKIPPED) !== 0;
  };

  // Pass-specific flags
  Skew.Symbol.prototype.isMerged = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_MERGED) !== 0;
  };

  Skew.Symbol.prototype.isObsolete = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_OBSOLETE) !== 0;
  };

  Skew.Symbol.prototype.isPrimaryConstructor = function() {
    var self = this;
    return (self.flags & Skew.Symbol.IS_PRIMARY_CONSTRUCTOR) !== 0;
  };

  // Combinations
  Skew.Symbol.prototype.isPrivateOrProtected = function() {
    var self = this;
    return (self.flags & (Skew.Symbol.IS_PRIVATE | Skew.Symbol.IS_PROTECTED)) !== 0;
  };

  Skew.Symbol.prototype.isImportedOrExported = function() {
    var self = this;
    return (self.flags & (Skew.Symbol.IS_IMPORTED | Skew.Symbol.IS_EXPORTED)) !== 0;
  };

  Skew.Symbol.prototype.asParameterSymbol = function() {
    var self = this;
    assert(Skew.SymbolKind.isParameter(self.kind));
    return self;
  };

  Skew.Symbol.prototype.asObjectSymbol = function() {
    var self = this;
    assert(Skew.SymbolKind.isObject(self.kind));
    return self;
  };

  Skew.Symbol.prototype.asFunctionSymbol = function() {
    var self = this;
    assert(Skew.SymbolKind.isFunction(self.kind));
    return self;
  };

  Skew.Symbol.prototype.asOverloadedFunctionSymbol = function() {
    var self = this;
    assert(Skew.SymbolKind.isOverloadedFunction(self.kind));
    return self;
  };

  Skew.Symbol.prototype.asVariableSymbol = function() {
    var self = this;
    assert(Skew.SymbolKind.isVariable(self.kind));
    return self;
  };

  Skew.Symbol.prototype.fullName = function() {
    var self = this;

    if (self.parent !== null && self.parent.kind !== Skew.SymbolKind.OBJECT_GLOBAL && !Skew.SymbolKind.isParameter(self.kind)) {
      return self.parent.fullName() + "." + self.name;
    }

    return self.name;
  };

  Skew.Symbol.prototype.mergeAnnotationsAndCommentsFrom = function(symbol) {
    var self = this;

    if (self.annotations === null) {
      self.annotations = symbol.annotations;
    }

    else if (symbol.annotations !== null) {
      in_List.append2(self.annotations, symbol.annotations);
    }

    if (self.comments === null) {
      self.comments = symbol.comments;
    }

    else if (symbol.comments !== null) {
      in_List.append2(self.comments, symbol.comments);
    }
  };

  Skew.Symbol.prototype.nameWithRenaming = function() {
    var self = this;

    if (self.isRenamed()) {
      for (var i = 0, list = self.annotations, count = list.length; i < count; ++i) {
        var annotation = list[i];

        if (annotation.symbol !== null && annotation.symbol.fullName() === "rename") {
          var children = annotation.annotationValue().children;

          if (children.length === 2) {
            return in_List.last(children).content.asString();
          }
        }
      }
    }

    return self.name;
  };

  Skew.Symbol.createID = function() {
    ++Skew.Symbol.nextID;
    return Skew.Symbol.nextID;
  };

  Skew.ParameterSymbol = function(kind, name) {
    var self = this;
    Skew.Symbol.call(self, kind, name);
  };

  __extends(Skew.ParameterSymbol, Skew.Symbol);

  Skew.Guard = function(parent, test, contents) {
    var self = this;
    self.parent = parent;
    self.test = test;
    self.contents = contents;
  };

  Skew.ObjectSymbol = function(kind, name) {
    var self = this;
    Skew.Symbol.call(self, kind, name);
    self.base = null;
    self.baseClass = null;
    self.members = Object.create(null);
    self.objects = [];
    self.functions = [];
    self.variables = [];
    self.parameters = null;
    self.guards = [];
  };

  __extends(Skew.ObjectSymbol, Skew.Symbol);

  Skew.ObjectSymbol.prototype.hasBaseClass = function(symbol) {
    var self = this;
    return self.baseClass !== null && (self.baseClass === symbol || self.baseClass.hasBaseClass(symbol));
  };

  Skew.FunctionSymbol = function(kind, name) {
    var self = this;
    Skew.Symbol.call(self, kind, name);
    self.overridden = null;
    self.overloaded = null;
    self.parameters = null;
    self.$arguments = [];
    self.self = null;
    self.argumentOnlyType = null;
    self.returnType = null;
    self.block = null;
  };

  __extends(Skew.FunctionSymbol, Skew.Symbol);

  Skew.VariableSymbol = function(kind, name) {
    var self = this;
    Skew.Symbol.call(self, kind, name);
    self.type = null;
    self.value = null;
  };

  __extends(Skew.VariableSymbol, Skew.Symbol);

  Skew.OverloadedFunctionSymbol = function(kind, name, symbols) {
    var self = this;
    Skew.Symbol.call(self, kind, name);
    self.overridden = null;
    self.symbols = symbols;
  };

  __extends(Skew.OverloadedFunctionSymbol, Skew.Symbol);

  Skew.TokenKind = {
    ANNOTATION: 0,
    ARROW: 1,
    AS: 2,
    ASSIGN: 3,
    ASSIGN_BITWISE_AND: 4,
    ASSIGN_BITWISE_OR: 5,
    ASSIGN_BITWISE_XOR: 6,
    ASSIGN_DIVIDE: 7,
    ASSIGN_INDEX: 8,
    ASSIGN_MINUS: 9,
    ASSIGN_MULTIPLY: 10,
    ASSIGN_PLUS: 11,
    ASSIGN_POWER: 12,
    ASSIGN_REMAINDER: 13,
    ASSIGN_SHIFT_LEFT: 14,
    ASSIGN_SHIFT_RIGHT: 15,
    BITWISE_AND: 16,
    BITWISE_OR: 17,
    BITWISE_XOR: 18,
    BREAK: 19,
    CASE: 20,
    CATCH: 21,
    CHARACTER: 22,
    CLASS: 23,
    COLON: 24,
    COMMA: 25,
    COMMENT: 26,
    COMPARE: 27,
    CONST: 28,
    CONTINUE: 29,
    DECREMENT: 30,
    DEF: 31,
    DEFAULT: 32,
    DIVIDE: 33,
    DOT: 34,
    DOT_DOT: 35,
    DOUBLE: 36,
    DYNAMIC: 37,
    ELSE: 38,
    END_OF_FILE: 39,
    ENUM: 40,
    EQUAL: 41,
    ERROR: 42,
    FALSE: 43,
    FINALLY: 44,
    FOR: 45,
    GREATER_THAN: 46,
    GREATER_THAN_OR_EQUAL: 47,
    IDENTIFIER: 48,
    IF: 49,
    IN: 50,
    INCREMENT: 51,
    INDEX: 52,
    INT: 53,
    INTERFACE: 54,
    INT_BINARY: 55,
    INT_HEX: 56,
    INT_OCTAL: 57,
    IS: 58,
    LEFT_BRACE: 59,
    LEFT_BRACKET: 60,
    LEFT_PARENTHESIS: 61,
    LESS_THAN: 62,
    LESS_THAN_OR_EQUAL: 63,
    LIST: 64,
    LIST_NEW: 65,
    LOGICAL_AND: 66,
    LOGICAL_OR: 67,
    MINUS: 68,
    MULTIPLY: 69,
    NAMESPACE: 70,
    NEWLINE: 71,
    NOT: 72,
    NOT_EQUAL: 73,
    NULL: 74,
    OVER: 75,
    PLUS: 76,
    POWER: 77,
    QUESTION_MARK: 78,
    REMAINDER: 79,
    RETURN: 80,
    RIGHT_BRACE: 81,
    RIGHT_BRACKET: 82,
    RIGHT_PARENTHESIS: 83,
    SET: 84,
    SET_NEW: 85,
    SHIFT_LEFT: 86,
    SHIFT_RIGHT: 87,
    STRING: 88,
    SUPER: 89,
    SWITCH: 90,
    THROW: 91,
    TILDE: 92,
    TRUE: 93,
    TRY: 94,
    VAR: 95,
    WHILE: 96,
    WHITESPACE: 97,
    YY_INVALID_ACTION: 98,

    // Token kinds not used by flex
    START_PARAMETER_LIST: 99,
    END_PARAMETER_LIST: 100
  };

  Skew.DiagnosticKind = {
    ERROR: 0,
    WARNING: 1
  };

  Skew.Diagnostic = function(kind, range, text) {
    var self = this;
    self.kind = kind;
    self.range = range;
    self.text = text;
    self.noteRange = null;
    self.noteText = "";
  };

  Skew.Log = function() {
    var self = this;
    self.diagnostics = [];
    self.warningCount = 0;
    self.errorCount = 0;
  };

  Skew.Log.prototype.hasErrors = function() {
    var self = this;
    return self.errorCount !== 0;
  };

  Skew.Log.prototype.hasWarnings = function() {
    var self = this;
    return self.warningCount !== 0;
  };

  Skew.Log.prototype.error = function(range, text) {
    var self = this;
    self.diagnostics.push(new Skew.Diagnostic(Skew.DiagnosticKind.ERROR, range, text));
    ++self.errorCount;
  };

  Skew.Log.prototype.warning = function(range, text) {
    var self = this;
    self.diagnostics.push(new Skew.Diagnostic(Skew.DiagnosticKind.WARNING, range, text));
    ++self.warningCount;
  };

  Skew.Log.prototype.note = function(range, text) {
    var self = this;
    var last = in_List.last(self.diagnostics);
    last.noteRange = range;
    last.noteText = text;
  };

  Skew.Log.prototype.syntaxErrorInvalidEscapeSequence = function(range) {
    var self = this;
    self.error(range, "Invalid escape sequence");
  };

  Skew.Log.prototype.syntaxErrorInvalidCharacter = function(range) {
    var self = this;
    self.error(range, "Invalid character literal");
  };

  Skew.Log.prototype.syntaxErrorExtraData = function(range, text) {
    var self = this;
    self.error(range, "Syntax error \"" + text + "\"");
  };

  Skew.Log.prototype.syntaxErrorUnexpectedToken = function(token) {
    var self = this;
    self.error(token.range, "Unexpected " + Skew.TokenKind.strings[token.kind]);
  };

  Skew.Log.prototype.syntaxErrorExpectedToken = function(range, found, expected) {
    var self = this;
    self.error(range, "Expected " + Skew.TokenKind.strings[expected] + " but found " + Skew.TokenKind.strings[found]);
  };

  Skew.Log.prototype.syntaxErrorEmptyFunctionParentheses = function(range) {
    var self = this;
    self.error(range, "Functions without arguments do not use parentheses");
  };

  Skew.Log.prototype.semanticErrorComparisonOperatorNotNumeric = function(range) {
    var self = this;
    self.error(range, "The comparison operator must have a numeric return type");
  };

  Skew.Log.prototype.syntaxErrorBadDeclarationInsideEnum = function(range) {
    var self = this;
    self.error(range, "Cannot use this declaration inside an enum");
  };

  Skew.Log.expectedCountText = function(singular, expected, found) {
    return "Expected " + expected.toString() + " " + singular + (expected === 1 ? "" : "s") + " but found " + found.toString() + " " + singular + (found === 1 ? "" : "s");
  };

  Skew.Log.formatArgumentTypes = function(types) {
    if (types === null) {
      return "";
    }

    var names = [];

    for (var i = 0, list = types, count = list.length; i < count; ++i) {
      var type = list[i];
      names.push(type.toString());
    }

    return " of type" + (types.length === 1 ? "" : "s") + " " + Skew.PrettyPrint.join(names, "and");
  };

  Skew.Log.prototype.semanticWarningExtraParentheses = function(range) {
    var self = this;
    self.warning(range, "Unnecessary parentheses");
  };

  Skew.Log.prototype.semanticWarningUnusedExpression = function(range) {
    var self = this;
    self.warning(range, "Unused expression");
  };

  Skew.Log.prototype.semanticErrorDuplicateSymbol = function(range, name, previous) {
    var self = this;
    self.error(range, "\"" + name + "\" is already declared");

    if (previous !== null) {
      self.note(previous, "The previous declaration is here");
    }
  };

  Skew.Log.prototype.semanticErrorShadowedSymbol = function(range, name, previous) {
    var self = this;
    self.error(range, "\"" + name + "\" shadows a previous declaration");

    if (previous !== null) {
      self.note(previous, "The previous declaration is here");
    }
  };

  Skew.Log.prototype.semanticErrorDuplicateTypeParameters = function(range, name, previous) {
    var self = this;
    self.error(range, "\"" + name + "\" already has type parameters");

    if (previous !== null) {
      self.note(previous, "Type parameters were previously declared here");
    }
  };

  Skew.Log.prototype.semanticErrorDuplicateBaseType = function(range, name, previous) {
    var self = this;
    self.error(range, "\"" + name + "\" already has a base type");

    if (previous !== null) {
      self.note(previous, "The previous base type is here");
    }
  };

  Skew.Log.prototype.semanticErrorCyclicDeclaration = function(range, name) {
    var self = this;
    self.error(range, "Cyclic declaration of \"" + name + "\"");
  };

  Skew.Log.prototype.semanticErrorUndeclaredSymbol = function(range, name) {
    var self = this;
    self.error(range, "\"" + name + "\" is not declared");
  };

  Skew.Log.prototype.semanticErrorUnknownMemberSymbol = function(range, name, type) {
    var self = this;
    self.error(range, "\"" + name + "\" is not declared on type \"" + type.toString() + "\"");
  };

  Skew.Log.prototype.semanticErrorVarMissingType = function(range, name) {
    var self = this;
    self.error(range, "Unable to determine the type of \"" + name + "\"");
  };

  Skew.Log.prototype.semanticErrorVarMissingValue = function(range, name) {
    var self = this;
    self.error(range, "The implicitly typed variable \"" + name + "\" must be initialized");
  };

  Skew.Log.prototype.semanticErrorConstMissingValue = function(range, name) {
    var self = this;
    self.error(range, "The constant \"" + name + "\" must be initialized");
  };

  Skew.Log.prototype.semanticErrorInvalidCall = function(range, type) {
    var self = this;
    self.error(range, "Cannot call value of type \"" + type.toString() + "\"");
  };

  Skew.Log.prototype.semanticErrorCannotParameterize = function(range, type) {
    var self = this;
    self.error(range, "Cannot parameterize \"" + type.toString() + (type.isParameterized() ? "\" because it is already parameterized" : "\" because it has no type parameters"));
  };

  Skew.Log.prototype.semanticErrorParameterCount = function(range, expected, found) {
    var self = this;
    self.error(range, Skew.Log.expectedCountText("type parameter", expected, found));
  };

  Skew.Log.prototype.semanticErrorArgumentCount = function(range, expected, found, name, $function) {
    var self = this;
    self.error(range, Skew.Log.expectedCountText("argument", expected, found) + (name !== "" ? " when calling \"" + name + "\"" : ""));

    if ($function !== null) {
      self.note($function, "The function declaration is here");
    }
  };

  Skew.Log.prototype.semanticErrorGetterCalledTwice = function(range, name, $function) {
    var self = this;
    self.error(range, "The function \"" + name + "\" takes no arguments and is already called implicitly");

    if ($function !== null) {
      self.note($function, "The function declaration is here");
    }
  };

  Skew.Log.prototype.semanticErrorUseOfVoidFunction = function(range, name, $function) {
    var self = this;
    self.error(range, "The function \"" + name + "\" does not return a value");

    if ($function !== null) {
      self.note($function, "The function declaration is here");
    }
  };

  Skew.Log.prototype.semanticErrorUseOfVoidLambda = function(range) {
    var self = this;
    self.error(range, "This call does not return a value");
  };

  Skew.Log.prototype.semanticErrorBadVariableType = function(range, type) {
    var self = this;
    self.error(range, "Implicitly typed variables cannot be of type \"" + type.toString() + "\"");
  };

  Skew.Log.prototype.semanticErrorMemberUnexpectedGlobal = function(range, name) {
    var self = this;
    self.error(range, "Cannot access global member \"" + name + "\" from an instance context");
  };

  Skew.Log.prototype.semanticErrorMemberUnexpectedInstance = function(range, name) {
    var self = this;
    self.error(range, "Cannot access instance member \"" + name + "\" from a global context");
  };

  Skew.Log.prototype.semanticErrorMemberUnexpectedTypeParameter = function(range, name) {
    var self = this;
    self.error(range, "Cannot access type parameter \"" + name + "\" here");
  };

  Skew.Log.prototype.semanticErrorConstructorReturnType = function(range) {
    var self = this;
    self.error(range, "Constructors cannot have a return type");
  };

  Skew.Log.prototype.semanticErrorNoMatchingOverload = function(range, name, count, types) {
    var self = this;
    self.error(range, "No overload of \"" + name + "\" was found that takes " + count.toString() + " argument" + (count === 1 ? "" : "s") + Skew.Log.formatArgumentTypes(types));
  };

  Skew.Log.prototype.semanticErrorAmbiguousOverload = function(range, name, count, types) {
    var self = this;
    self.error(range, "Multiple matching overloads of \"" + name + "\" were found that can take " + count.toString() + " argument" + (count === 1 ? "" : "s") + Skew.Log.formatArgumentTypes(types));
  };

  Skew.Log.prototype.semanticErrorUnexpectedExpression = function(range, type) {
    var self = this;
    self.error(range, "Unexpected expression of type \"" + type.toString() + "\"");
  };

  Skew.Log.prototype.semanticErrorUnexpectedType = function(range, type) {
    var self = this;
    self.error(range, "Unexpected type \"" + type.toString() + "\"");
  };

  Skew.Log.prototype.semanticErrorIncompatibleTypes = function(range, from, to, isCastAllowed) {
    var self = this;
    self.error(range, "Cannot convert from type \"" + from.toString() + "\" to type \"" + to.toString() + "\"" + (isCastAllowed ? " without a cast" : ""));
  };

  Skew.Log.prototype.semanticErrorInvalidDefine1 = function(range, value, type, name) {
    var self = this;
    self.error(range, "Cannot convert \"" + value + "\" to type \"" + type.toString() + "\" for variable \"" + name + "\"");
  };

  Skew.Log.prototype.semanticWarningExtraCast = function(range, from, to) {
    var self = this;
    self.warning(range, "Unnecessary cast from type \"" + from.toString() + "\" to type \"" + to.toString() + "\"");
  };

  Skew.Log.prototype.semanticErrorWrongArgumentCount = function(range, name, count) {
    var self = this;
    self.error(range, "Expected \"" + name + "\" to take " + count.toString() + " argument" + (count === 1 ? "" : "s"));
  };

  Skew.Log.prototype.semanticErrorWrongArgumentCountRange = function(range, name, lower, upper) {
    var self = this;

    if (lower === 0) {
      self.error(range, "Expected \"" + name + "\" to take at most " + upper.toString() + " argument" + (upper === 1 ? "" : "s"));
    }

    else if (upper === -1) {
      self.error(range, "Expected \"" + name + "\" to take at least " + lower.toString() + " argument" + (lower === 1 ? "" : "s"));
    }

    else {
      self.error(range, "Expected \"" + name + "\" to take between " + lower.toString() + " and " + upper.toString() + " arguments");
    }
  };

  Skew.Log.prototype.semanticErrorExpectedList = function(range, name, type) {
    var self = this;
    self.error(range, "Expected argument \"" + name + "\" to be of type \"List<T>\" instead of type \"" + type.toString() + "\"");
  };

  Skew.Log.prototype.semanticErrorUnexpectedReturnValue = function(range) {
    var self = this;
    self.error(range, "Cannot return a value inside a function without a return type");
  };

  Skew.Log.prototype.semanticErrorBadReturnType = function(range, type) {
    var self = this;
    self.error(range, "Cannot create a function with a return type of \"" + type.toString() + "\"");
  };

  Skew.Log.prototype.semanticErrorExpectedReturnValue = function(range, type) {
    var self = this;
    self.error(range, "Must return a value of type \"" + type.toString() + "\"");
  };

  Skew.Log.prototype.semanticErrorMissingReturn = function(range, name, type) {
    var self = this;
    self.error(range, "All control paths for \"" + name + "\" must return a value of type \"" + type.toString() + "\"");
  };

  Skew.Log.prototype.semanticErrorBadStorage = function(range) {
    var self = this;
    self.error(range, "Cannot store to this location");
  };

  Skew.Log.prototype.semanticErrorStorageToConstSymbol = function(range, name) {
    var self = this;
    self.error(range, "Cannot store to constant symbol \"" + name + "\"");
  };

  Skew.Log.prototype.semanticErrorAccessViolation = function(range, level, name) {
    var self = this;
    self.error(range, "Cannot access \"" + level + "\" symbol \"" + name + "\" here");
  };

  Skew.Log.prototype.semanticWarningDeprecatedUsage = function(range, name) {
    var self = this;
    self.warning(range, "Use of deprecated symbol \"" + name + "\"");
  };

  Skew.Log.prototype.semanticErrorUnparameterizedType = function(range, type) {
    var self = this;
    self.error(range, "Cannot use unparameterized type \"" + type.toString() + "\" here");
  };

  Skew.Log.prototype.semanticErrorParameterizedType = function(range, type) {
    var self = this;
    self.error(range, "Cannot use parameterized type \"" + type.toString() + "\" here");
  };

  Skew.Log.prototype.semanticErrorNoCommonType = function(range, left, right) {
    var self = this;
    self.error(range, "No common type for \"" + left.toString() + "\" and \"" + right.toString() + "\"");
  };

  Skew.Log.prototype.semanticErrorInvalidAnnotation = function(range, annotation, name) {
    var self = this;
    self.error(range, "Cannot use the annotation \"" + annotation + "\" on \"" + name + "\"");
  };

  Skew.Log.prototype.semanticErrorDuplicateAnnotation = function(range, annotation, name) {
    var self = this;
    self.error(range, "Duplicate annotation \"" + annotation + "\" on \"" + name + "\"");
  };

  Skew.Log.prototype.semanticErrorBadForValue = function(range, type) {
    var self = this;
    self.error(range, "Cannot iterate over type \"" + type.toString() + "\"");
  };

  Skew.Log.prototype.semanticWarningEmptyRange = function(range) {
    var self = this;
    self.warning(range, "This range is empty");
  };

  Skew.Log.prototype.semanticErrorMissingDotContext = function(range, name) {
    var self = this;
    self.error(range, "Cannot access \"" + name + "\" without type context");
  };

  Skew.Log.prototype.semanticErrorInitializerTypeInferenceFailed = function(range) {
    var self = this;
    self.error(range, "Cannot infer a type for this literal");
  };

  Skew.Log.prototype.semanticErrorDuplicateOverload = function(range, name, previous) {
    var self = this;
    self.error(range, "Duplicate overloaded function \"" + name + "\"");

    if (previous !== null) {
      self.note(previous, "The previous declaration is here");
    }
  };

  Skew.Log.prototype.semanticErrorInvalidBaseType = function(range, type) {
    var self = this;
    self.error(range, "Cannot derive from type \"" + type.toString() + "\"");
  };

  Skew.Log.prototype.semanticErrorBadOverride = function(range, name, base, overridden) {
    var self = this;
    self.error(range, "\"" + name + "\" overrides another declaration with the same name in base type \"" + base.toString() + "\"");

    if (overridden !== null) {
      self.note(overridden, "The overridden declaration is here");
    }
  };

  Skew.Log.prototype.semanticErrorBadOverrideReturnType = function(range, name, base, overridden) {
    var self = this;
    self.error(range, "\"" + name + "\" overrides another function with the same name and argument types but a different return type in base type \"" + base.toString() + "\"");

    if (overridden !== null) {
      self.note(overridden, "The overridden function is here");
    }
  };

  Skew.Log.prototype.semanticErrorModifierMissingOverride = function(range, name, overridden) {
    var self = this;
    self.error(range, "\"" + name + "\" overrides another symbol with the same name but is declared using \"def\" instead of \"over\"");

    if (overridden !== null) {
      self.note(overridden, "The overridden declaration is here");
    }
  };

  Skew.Log.prototype.semanticErrorModifierUnusedOverride = function(range, name) {
    var self = this;
    self.error(range, "\"" + name + "\" is declared using \"over\" instead of \"def\" but does not override anything");
  };

  Skew.Log.prototype.semanticErrorBadSuper = function(range) {
    var self = this;
    self.error(range, "Cannot use \"super\" here");
  };

  Skew.Log.prototype.semanticErrorBadJump = function(range, name) {
    var self = this;
    self.error(range, "Cannot use \"" + name + "\" outside a loop");
  };

  Skew.Log.prototype.semanticErrorMustCallFunction = function(range, name) {
    var self = this;
    self.error(range, "The function \"" + name + "\" must be called");
  };

  Skew.Log.prototype.semanticErrorDuplicateEntryPoint = function(range, previous) {
    var self = this;
    self.error(range, "Multiple entry points are declared");
    self.note(previous, "The first entry point is here");
  };

  Skew.Log.prototype.semanticErrorInvalidEntryPointArguments = function(range, name) {
    var self = this;
    self.error(range, "Entry point \"" + name + "\" must take either no arguments or one argument of type \"List<string>\"");
  };

  Skew.Log.prototype.semanticErrorInvalidEntryPointReturnType = function(range, name) {
    var self = this;
    self.error(range, "Entry point \"" + name + "\" must return either nothing or a value of type \"int\"");
  };

  Skew.Log.prototype.semanticErrorInvalidDefine2 = function(range, name) {
    var self = this;
    self.error(range, "Could not find a variable named \"" + name + "\" to override");
  };

  Skew.Log.prototype.semanticErrorExpectedConstant = function(range) {
    var self = this;
    self.error(range, "This value must be a compile-time constant");
  };

  Skew.Log.prototype.semanticWarningUnreadLocalVariable = function(range, name) {
    var self = this;
    self.warning(range, "Local variable \"" + name + "\" is never read");
  };

  Skew.Log.prototype.commandLineErrorExpectedDefineValue = function(range, name) {
    var self = this;
    self.error(range, "Use \"--define:" + name + "=___\" to provide a value");
  };

  Skew.Log.prototype.commandLineErrorMissingOutput = function(range, first, second) {
    var self = this;
    self.error(range, "Specify the output location using either \"" + first + "\" or \"" + second + "\"");
  };

  Skew.Log.prototype.commandLineErrorDuplicateOutput = function(range, first, second) {
    var self = this;
    self.error(range, "Cannot specify both \"" + first + "\" and \"" + second + "\"");
  };

  Skew.Log.prototype.commandLineErrorUnreadableFile = function(range, name) {
    var self = this;
    self.error(range, "Could not read from \"" + name + "\"");
  };

  Skew.Log.prototype.commandLineErrorUnwritableFile = function(range, name) {
    var self = this;
    self.error(range, "Could not write to \"" + name + "\"");
  };

  Skew.Log.prototype.commandLineErrorNoInputFiles = function(range) {
    var self = this;
    self.error(range, "Missing input files");
  };

  Skew.Log.prototype.commandLineWarningDuplicateFlagValue = function(range, name, previous) {
    var self = this;
    self.warning(range, "Multiple values are specified for \"" + name + "\", using the later value");

    if (previous !== null) {
      self.note(previous, "Ignoring the previous value");
    }
  };

  Skew.Log.prototype.commandLineErrorBadFlag = function(range, name) {
    var self = this;
    self.error(range, "Unknown command line flag \"" + name + "\"");
  };

  Skew.Log.prototype.commandLineErrorMissingValue = function(range, text) {
    var self = this;
    self.error(range, "Use \"" + text + "\" to provide a value");
  };

  Skew.Log.prototype.commandLineErrorExpectedToken = function(range, expected, found, text) {
    var self = this;
    self.error(range, "Expected \"" + expected + "\" but found \"" + found + "\" in \"" + text + "\"");
  };

  Skew.Log.prototype.commandLineErrorNonBooleanValue = function(range, value, text) {
    var self = this;
    self.error(range, "Expected \"true\" or \"false\" but found \"" + value + "\" in \"" + text + "\"");
  };

  Skew.Log.prototype.commandLineErrorNonIntegerValue = function(range, value, text) {
    var self = this;
    self.error(range, "Expected integer constant but found \"" + value + "\" in \"" + text + "\"");
  };

  Skew.Parsing = {};

  Skew.Parsing.parseIntLiteral = function(text) {
    // Parse negative signs for use with the "--define" flag
    var isNegative = in_string.startsWith(text, "-");
    var start = isNegative | 0;
    var count = text.length;
    var value = 0;
    var base = 10;

    // Parse the base
    if ((start + 2 | 0) < count && text.charCodeAt(start) === 48) {
      var c = text.charCodeAt(start + 1 | 0);

      if (c === 98) {
        base = 2;
        start += 2;
      }

      else if (c === 111) {
        base = 8;
        start += 2;
      }

      else if (c === 120) {
        base = 16;
        start += 2;
      }
    }

    // There must be numbers after the base
    if (start === count) {
      return null;
    }

    // Special-case hexadecimal since it's more complex
    if (base === 16) {
      for (var i = start, count1 = text.length; i < count1; ++i) {
        var c1 = text.charCodeAt(i);

        if ((c1 < 48 || c1 > 57) && (c1 < 65 || c1 > 70) && (c1 < 97 || c1 > 102)) {
          return null;
        }

        value = (__imul(value, 16) + c1 | 0) - (c1 <= 57 ? 48 : c1 <= 70 ? 65 - 10 | 0 : 97 - 10 | 0) | 0;
      }
    }

    // All other bases are zero-relative
    else {
      for (var i1 = start, count2 = text.length; i1 < count2; ++i1) {
        var c2 = text.charCodeAt(i1);

        if (c2 < 48 || c2 >= (48 + base | 0)) {
          return null;
        }

        value = (__imul(value, base) + c2 | 0) - 48 | 0;
      }
    }

    return new Box(isNegative ? -value : value);
  };

  Skew.Parsing.checkExtraParentheses = function(context, node) {
    if (node.isInsideParentheses()) {
      context.log.semanticWarningExtraParentheses(node.range);
    }
  };

  Skew.Parsing.parseLeadingComments = function(context) {
    var comments = null;

    while (context.peek(Skew.TokenKind.COMMENT)) {
      var range = context.next().range;

      if (comments === null) {
        comments = [];
      }

      comments.push(range.source.contents.slice(range.start + 1 | 0, range.end));

      // Ignore blocks of comments with extra lines afterward
      if (context.eat(Skew.TokenKind.NEWLINE)) {
        comments = null;
      }
    }

    return comments;
  };

  Skew.Parsing.parseTrailingComment = function(context, comments) {
    if (context.peek(Skew.TokenKind.COMMENT)) {
      var range = context.next().range;

      if (comments === null) {
        comments = [];
      }

      var text = range.source.contents.slice(range.start + 1 | 0, range.end);

      if (text.charCodeAt(text.length - 1 | 0) !== 10) {
        text += "\n";
      }

      comments.push(text);
      return comments;
    }

    return null;
  };

  Skew.Parsing.parseAnnotations = function(context, annotations) {
    annotations = annotations !== null ? annotations.slice() : [];

    while (context.peek(Skew.TokenKind.ANNOTATION)) {
      var range = context.next().range;
      var value = new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent(range.toString())).withRange(range);

      // Change "@foo.bar.baz" into "foo.bar.@baz"
      if (context.peek(Skew.TokenKind.DOT)) {
        var root = value.asString();
        value.content = new Skew.StringContent(root.slice(1));

        while (context.eat(Skew.TokenKind.DOT)) {
          var name = context.current().range;

          if (!context.expect(Skew.TokenKind.IDENTIFIER)) {
            return null;
          }

          value = new Skew.Node(Skew.NodeKind.DOT).withContent(new Skew.StringContent(name.toString())).withChildren([value]).withRange(context.spanSince(range)).withInternalRange(name);
        }

        value.content = new Skew.StringContent("@" + value.asString());
      }

      // Parse parentheses if present
      var token = context.current();

      if (context.eat(Skew.TokenKind.LEFT_PARENTHESIS)) {
        var $arguments = Skew.Parsing.parseCommaSeparatedList(context, Skew.TokenKind.RIGHT_PARENTHESIS);

        if ($arguments === null) {
          return null;
        }

        value = Skew.Node.createCall(value, $arguments).withRange(context.spanSince(range)).withInternalRange(context.spanSince(token.range));
      }

      // Parse a trailing if condition
      var test = null;

      if (context.eat(Skew.TokenKind.IF)) {
        test = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

        if (test === null) {
          return null;
        }
      }

      // All annotations must end in a newline to avoid confusion with the trailing if
      if (!context.peek(Skew.TokenKind.LEFT_BRACE) && !context.expect(Skew.TokenKind.NEWLINE)) {
        return null;
      }

      annotations.push(Skew.Node.createAnnotation(value, test).withRange(context.spanSince(range)));
    }

    return annotations;
  };

  Skew.Parsing.parseVarOrConst = function(context) {
    var token = context.next();
    var range = context.current().range;

    if (!context.expect(Skew.TokenKind.IDENTIFIER)) {
      return null;
    }

    var symbol = new Skew.VariableSymbol(Skew.SymbolKind.VARIABLE_LOCAL, range.toString());
    symbol.range = range;

    if (token.kind === Skew.TokenKind.CONST) {
      symbol.flags |= Skew.Symbol.IS_CONST;
    }

    if (Skew.Parsing.peekType(context)) {
      symbol.type = Skew.Parsing.typePratt.parse(context, Skew.Precedence.LOWEST);

      if (symbol.type === null) {
        return null;
      }
    }

    if (context.eat(Skew.TokenKind.ASSIGN)) {
      symbol.value = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

      if (symbol.value === null) {
        return null;
      }
    }

    return Skew.Node.createVar(symbol).withRange(context.spanSince(token.range));
  };

  Skew.Parsing.parseJump = function(context) {
    var token = context.next();
    return (token.kind === Skew.TokenKind.BREAK ? new Skew.Node(Skew.NodeKind.BREAK) : new Skew.Node(Skew.NodeKind.CONTINUE)).withRange(token.range);
  };

  Skew.Parsing.parseReturn = function(context) {
    var token = context.next();
    var value = null;

    if (!context.peek(Skew.TokenKind.NEWLINE) && !context.peek(Skew.TokenKind.COMMENT) && !context.peek(Skew.TokenKind.RIGHT_BRACE)) {
      value = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

      if (value === null) {
        return null;
      }

      Skew.Parsing.checkExtraParentheses(context, value);
    }

    return Skew.Node.createReturn(value).withRange(context.spanSince(token.range));
  };

  Skew.Parsing.parseSwitch = function(context) {
    var token = context.next();
    var value = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

    if (value === null) {
      return null;
    }

    Skew.Parsing.checkExtraParentheses(context, value);

    if (!context.expect(Skew.TokenKind.LEFT_BRACE)) {
      return null;
    }

    var cases = [];
    context.eat(Skew.TokenKind.NEWLINE);

    while (!context.peek(Skew.TokenKind.RIGHT_BRACE)) {
      var comments = Skew.Parsing.parseLeadingComments(context);

      // Ignore trailing comments
      if (context.peek(Skew.TokenKind.RIGHT_BRACE) || context.peek(Skew.TokenKind.END_OF_FILE)) {
        break;
      }

      // Parse a new case
      var values = [];
      var start = context.current();

      if (context.eat(Skew.TokenKind.CASE)) {
        context.eat(Skew.TokenKind.NEWLINE);

        while (true) {
          var constant = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

          if (constant === null) {
            return null;
          }

          Skew.Parsing.checkExtraParentheses(context, constant);
          values.push(constant);

          if (!context.eat(Skew.TokenKind.COMMA)) {
            break;
          }
        }
      }

      // Default cases have no values
      else if (!context.eat(Skew.TokenKind.DEFAULT)) {
        context.expect(Skew.TokenKind.CASE);
        return null;
      }

      // Use a block instead of requiring "break" at the end
      var block = Skew.Parsing.parseBlock(context);

      if (block === null) {
        return null;
      }

      // Create the case
      var node = Skew.Node.createCase(values, block).withRange(context.spanSince(start.range));
      node.comments = comments;
      cases.push(node);

      // Parse trailing comments and/or newline
      comments = Skew.Parsing.parseTrailingComment(context, comments);

      if (comments !== null) {
        node.comments = comments;
        context.eat(Skew.TokenKind.NEWLINE);
      }

      else if (context.peek(Skew.TokenKind.RIGHT_BRACE) || !context.peek(Skew.TokenKind.ELSE) && !context.expect(Skew.TokenKind.NEWLINE)) {
        break;
      }
    }

    if (!context.expect(Skew.TokenKind.RIGHT_BRACE)) {
      return null;
    }

    return Skew.Node.createSwitch(value, cases).withRange(context.spanSince(token.range));
  };

  Skew.Parsing.parseFor = function(context) {
    var token = context.next();
    var range = context.current().range;

    if (!context.expect(Skew.TokenKind.IDENTIFIER) || !context.expect(Skew.TokenKind.IN)) {
      return null;
    }

    var symbol = new Skew.VariableSymbol(Skew.SymbolKind.VARIABLE_LOCAL, range.toString());
    symbol.range = range;
    var value = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

    if (value === null) {
      return null;
    }

    if (context.eat(Skew.TokenKind.DOT_DOT)) {
      var second = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

      if (second === null) {
        return null;
      }

      value = Skew.Node.createPair(value, second).withRange(Skew.Range.span(value.range, second.range));
    }

    Skew.Parsing.checkExtraParentheses(context, value);
    var block = Skew.Parsing.parseBlock(context);

    if (block === null) {
      return null;
    }

    return Skew.Node.createForeach(symbol, value, block).withRange(context.spanSince(token.range));
  };

  Skew.Parsing.parseIf = function(context) {
    var token = context.next();
    var test = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

    if (test === null) {
      return null;
    }

    Skew.Parsing.checkExtraParentheses(context, test);
    var trueBlock = Skew.Parsing.parseBlock(context);

    if (trueBlock === null) {
      return null;
    }

    return Skew.Node.createIf(test, trueBlock, null).withRange(context.spanSince(token.range));
  };

  Skew.Parsing.parseThrow = function(context) {
    var token = context.next();
    var value = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

    if (value === null) {
      return null;
    }

    Skew.Parsing.checkExtraParentheses(context, value);
    return Skew.Node.createThrow(value).withRange(context.spanSince(token.range));
  };

  Skew.Parsing.parseTry = function(context) {
    var token = context.next();
    var tryBlock = Skew.Parsing.parseBlock(context);

    if (tryBlock === null) {
      return null;
    }

    return Skew.Node.createTry(tryBlock, [], null).withRange(context.spanSince(token.range));
  };

  Skew.Parsing.parseWhile = function(context) {
    var token = context.next();
    var test = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

    if (test === null) {
      return null;
    }

    Skew.Parsing.checkExtraParentheses(context, test);
    var block = Skew.Parsing.parseBlock(context);

    if (block === null) {
      return null;
    }

    return new Skew.Node(Skew.NodeKind.WHILE).withChildren([test, block]).withRange(context.spanSince(token.range));
  };

  Skew.Parsing.parseStatement = function(context) {
    var token = context.current();

    switch (token.kind) {
      case Skew.TokenKind.BREAK:
      case Skew.TokenKind.CONTINUE: {
        return Skew.Parsing.parseJump(context);
      }

      case Skew.TokenKind.CONST:
      case Skew.TokenKind.VAR: {
        return Skew.Parsing.parseVarOrConst(context);
      }

      case Skew.TokenKind.FOR: {
        return Skew.Parsing.parseFor(context);
      }

      case Skew.TokenKind.IF: {
        return Skew.Parsing.parseIf(context);
      }

      case Skew.TokenKind.RETURN: {
        return Skew.Parsing.parseReturn(context);
      }

      case Skew.TokenKind.SWITCH: {
        return Skew.Parsing.parseSwitch(context);
      }

      case Skew.TokenKind.THROW: {
        return Skew.Parsing.parseThrow(context);
      }

      case Skew.TokenKind.TRY: {
        return Skew.Parsing.parseTry(context);
      }

      case Skew.TokenKind.WHILE: {
        return Skew.Parsing.parseWhile(context);
      }
    }

    var value = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

    if (value === null) {
      return null;
    }

    Skew.Parsing.checkExtraParentheses(context, value);
    return Skew.Node.createExpression(value).withRange(value.range);
  };

  Skew.Parsing.parseStatements = function(context) {
    var statements = [];
    var previous = null;
    context.eat(Skew.TokenKind.NEWLINE);

    while (!context.peek(Skew.TokenKind.RIGHT_BRACE)) {
      var comments = Skew.Parsing.parseLeadingComments(context);

      // Ignore trailing comments
      if (context.peek(Skew.TokenKind.RIGHT_BRACE) || context.peek(Skew.TokenKind.END_OF_FILE)) {
        break;
      }

      // Merge "else" statements with the previous "if"
      if (context.peek(Skew.TokenKind.ELSE) && previous !== null && previous.kind === Skew.NodeKind.IF && previous.ifFalse() === null) {
        context.next();

        // Match "else if"
        if (context.peek(Skew.TokenKind.IF)) {
          var statement = Skew.Parsing.parseIf(context);

          if (statement === null) {
            return null;
          }

          var falseBlock = new Skew.Node(Skew.NodeKind.BLOCK).withChildren([statement]).withRange(statement.range);
          falseBlock.comments = comments;
          previous.replaceChild(2, falseBlock);
          previous = statement;
        }

        // Match "else"
        else {
          var falseBlock1 = Skew.Parsing.parseBlock(context);

          if (falseBlock1 === null) {
            return null;
          }

          falseBlock1.comments = comments;
          previous.replaceChild(2, falseBlock1);
          previous = falseBlock1;
        }
      }

      // Merge "catch" statements with the previous "try"
      else if (context.peek(Skew.TokenKind.CATCH) && previous !== null && previous.kind === Skew.NodeKind.TRY && previous.finallyBlock() === null) {
        var catchToken = context.next();
        var symbol = null;
        var nameRange = context.current().range;

        // Optional typed variable
        if (context.eat(Skew.TokenKind.IDENTIFIER)) {
          symbol = new Skew.VariableSymbol(Skew.SymbolKind.VARIABLE_LOCAL, nameRange.toString());
          symbol.range = nameRange;
          symbol.type = Skew.Parsing.typePratt.parse(context, Skew.Precedence.LOWEST);

          if (symbol.type === null) {
            return null;
          }
        }

        // Manditory catch block
        var catchBlock = Skew.Parsing.parseBlock(context);

        if (catchBlock === null) {
          return null;
        }

        var child = Skew.Node.createCatch(symbol, catchBlock).withRange(context.spanSince(catchToken.range));
        child.comments = comments;
        previous.insertChild(previous.children.length - 1 | 0, child);
      }

      // Merge "finally" statements with the previous "try"
      else if (context.peek(Skew.TokenKind.FINALLY) && previous !== null && previous.kind === Skew.NodeKind.TRY && previous.finallyBlock() === null) {
        context.next();
        var finallyBlock = Skew.Parsing.parseBlock(context);

        if (finallyBlock === null) {
          return null;
        }

        finallyBlock.comments = comments;
        previous.replaceChild(previous.children.length - 1 | 0, finallyBlock);
      }

      // Parse a new statement
      else {
        var statement1 = Skew.Parsing.parseStatement(context);

        if (statement1 === null) {
          break;
        }

        previous = statement1;
        statement1.comments = comments;
        statements.push(statement1);
      }

      // Parse trailing comments and/or newline
      comments = Skew.Parsing.parseTrailingComment(context, comments);

      if (comments !== null) {
        if (previous !== null) {
          previous.comments = comments;
        }

        context.eat(Skew.TokenKind.NEWLINE);
      }

      else if (context.peek(Skew.TokenKind.RIGHT_BRACE) || !context.peek(Skew.TokenKind.ELSE) && !context.peek(Skew.TokenKind.CATCH) && !context.peek(Skew.TokenKind.FINALLY) && !context.expect(Skew.TokenKind.NEWLINE)) {
        break;
      }
    }

    return statements;
  };

  Skew.Parsing.parseBlock = function(context) {
    var token = context.current();

    if (!context.expect(Skew.TokenKind.LEFT_BRACE)) {
      return null;
    }

    var statements = Skew.Parsing.parseStatements(context);

    if (!context.expect(Skew.TokenKind.RIGHT_BRACE)) {
      return null;
    }

    return new Skew.Node(Skew.NodeKind.BLOCK).withChildren(statements).withRange(context.spanSince(token.range));
  };

  Skew.Parsing.peekType = function(context) {
    return context.peek(Skew.TokenKind.IDENTIFIER) || context.peek(Skew.TokenKind.DYNAMIC);
  };

  Skew.Parsing.parseFunctionBlock = function(context, symbol) {
    // "=> x" is the same as "{ return x }"
    if (symbol.kind === Skew.SymbolKind.FUNCTION_LOCAL) {
      if (!context.expect(Skew.TokenKind.ARROW)) {
        return false;
      }

      if (context.peek(Skew.TokenKind.LEFT_BRACE)) {
        symbol.block = Skew.Parsing.parseBlock(context);

        if (symbol.block === null) {
          return false;
        }
      }

      else {
        var value = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

        if (value === null) {
          return false;
        }

        symbol.block = new Skew.Node(Skew.NodeKind.BLOCK).withChildren([Skew.Node.createReturn(value).withRange(value.range).withFlags(Skew.Node.IS_IMPLICIT_RETURN)]).withRange(value.range);
      }
    }

    // Parse function body if present
    else if (context.peek(Skew.TokenKind.LEFT_BRACE)) {
      symbol.block = Skew.Parsing.parseBlock(context);

      if (symbol.block === null) {
        return false;
      }
    }

    return true;
  };

  Skew.Parsing.parseFunctionArguments = function(context, symbol) {
    var usingTypes = false;

    while (!context.eat(Skew.TokenKind.RIGHT_PARENTHESIS)) {
      if (!(symbol.$arguments.length === 0) && !context.expect(Skew.TokenKind.COMMA)) {
        return false;
      }

      var range = context.current().range;

      if (!context.expect(Skew.TokenKind.IDENTIFIER)) {
        return false;
      }

      var arg = new Skew.VariableSymbol(Skew.SymbolKind.VARIABLE_LOCAL, range.toString());
      arg.range = range;

      // Parse argument type
      if (symbol.kind !== Skew.SymbolKind.FUNCTION_LOCAL || (symbol.$arguments.length === 0 ? Skew.Parsing.peekType(context) : usingTypes)) {
        arg.type = Skew.Parsing.typePratt.parse(context, Skew.Precedence.LOWEST);

        if (arg.type === null) {
          return false;
        }

        usingTypes = true;
      }

      // Parse default value
      if (context.eat(Skew.TokenKind.ASSIGN)) {
        arg.value = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

        if (arg.value === null) {
          return false;
        }
      }

      symbol.$arguments.push(arg);
    }

    return true;
  };

  Skew.Parsing.parseFunctionReturnTypeAndBlock = function(context, symbol) {
    if (Skew.Parsing.peekType(context)) {
      symbol.returnType = Skew.Parsing.typePratt.parse(context, Skew.Precedence.LOWEST);
    }

    return Skew.Parsing.parseFunctionBlock(context, symbol);
  };

  Skew.Parsing.parseTypeParameters = function(context, kind) {
    var parameters = [];

    while (true) {
      var range = context.current().range;
      var name = range.toString();

      if (!context.expect(Skew.TokenKind.IDENTIFIER)) {
        return null;
      }

      var symbol = new Skew.ParameterSymbol(kind, name);
      symbol.range = range;
      parameters.push(symbol);

      if (!context.eat(Skew.TokenKind.COMMA)) {
        break;
      }
    }

    if (!context.expect(Skew.TokenKind.END_PARAMETER_LIST)) {
      return null;
    }

    return parameters;
  };

  Skew.Parsing.parseAfterBlock = function(context) {
    return context.peek(Skew.TokenKind.END_OF_FILE) || context.peek(Skew.TokenKind.RIGHT_BRACE) || context.expect(Skew.TokenKind.NEWLINE);
  };

  Skew.Parsing.parseSymbol = function(context, parent, annotations) {
    // Parse comments before the symbol declaration
    var comments = Skew.Parsing.parseLeadingComments(context);

    // Ignore trailing comments
    if (context.peek(Skew.TokenKind.RIGHT_BRACE) || context.peek(Skew.TokenKind.END_OF_FILE)) {
      return false;
    }

    // Parse a compile-time if statement
    if (context.eat(Skew.TokenKind.IF)) {
      var test = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

      if (test === null || !context.expect(Skew.TokenKind.LEFT_BRACE)) {
        return false;
      }

      var contents = new Skew.ObjectSymbol(parent.kind, "<conditional>");
      Skew.Parsing.parseSymbols(context, contents, annotations);

      if (!context.expect(Skew.TokenKind.RIGHT_BRACE) || !Skew.Parsing.parseAfterBlock(context)) {
        return false;
      }

      parent.guards.push(new Skew.Guard(parent, test, contents));
      return true;
    }

    // Parse annotations before the symbol declaration
    if (context.peek(Skew.TokenKind.ANNOTATION)) {
      annotations = Skew.Parsing.parseAnnotations(context, annotations);

      if (annotations === null) {
        return false;
      }

      // Parse an annotation block
      if (context.eat(Skew.TokenKind.LEFT_BRACE)) {
        Skew.Parsing.parseSymbols(context, parent, annotations);
        return context.expect(Skew.TokenKind.RIGHT_BRACE) && Skew.Parsing.parseAfterBlock(context);
      }
    }

    var token = context.current();
    var symbol;

    // Special-case enum symbols
    if (parent.kind === Skew.SymbolKind.OBJECT_ENUM && token.kind === Skew.TokenKind.IDENTIFIER) {
      var variable = new Skew.VariableSymbol(Skew.SymbolKind.VARIABLE_ENUM, token.range.toString());
      variable.range = token.range;
      variable.flags |= Skew.Symbol.IS_CONST;
      parent.variables.push(variable);
      symbol = variable;
      context.next();
    }

    else {
      // Parse the symbol kind
      var kind;

      switch (token.kind) {
        case Skew.TokenKind.CLASS: {
          kind = Skew.SymbolKind.OBJECT_CLASS;
          break;
        }

        case Skew.TokenKind.CONST:
        case Skew.TokenKind.VAR: {
          kind = Skew.SymbolKind.hasInstances(parent.kind) ? Skew.SymbolKind.VARIABLE_INSTANCE : Skew.SymbolKind.VARIABLE_GLOBAL;
          break;
        }

        case Skew.TokenKind.DEF:
        case Skew.TokenKind.OVER: {
          kind = Skew.SymbolKind.hasInstances(parent.kind) ? Skew.SymbolKind.FUNCTION_INSTANCE : Skew.SymbolKind.FUNCTION_GLOBAL;
          break;
        }

        case Skew.TokenKind.ENUM: {
          kind = Skew.SymbolKind.OBJECT_ENUM;
          break;
        }

        case Skew.TokenKind.INTERFACE: {
          kind = Skew.SymbolKind.OBJECT_INTERFACE;
          break;
        }

        case Skew.TokenKind.NAMESPACE: {
          kind = Skew.SymbolKind.OBJECT_NAMESPACE;
          break;
        }

        default: {
          context.unexpectedToken();
          return false;
        }
      }

      context.next();

      // Parse the symbol name
      var nameToken = context.current();
      var range = nameToken.range;
      var name = range.toString();
      var isOperator = kind === Skew.SymbolKind.FUNCTION_INSTANCE && nameToken.kind in Skew.Parsing.operatorOverloadTokenKinds;

      if (isOperator) {
        context.next();
      }

      else if (kind === Skew.SymbolKind.FUNCTION_GLOBAL && context.eat(Skew.TokenKind.ANNOTATION)) {
        kind = Skew.SymbolKind.FUNCTION_ANNOTATION;
      }

      else if (context.eat(Skew.TokenKind.LIST_NEW) || context.eat(Skew.TokenKind.SET_NEW)) {
        if (kind === Skew.SymbolKind.FUNCTION_INSTANCE) {
          kind = Skew.SymbolKind.FUNCTION_CONSTRUCTOR;
        }
      }

      else {
        if (!context.expect(Skew.TokenKind.IDENTIFIER)) {
          return false;
        }

        if (kind === Skew.SymbolKind.FUNCTION_INSTANCE && name === "new") {
          kind = Skew.SymbolKind.FUNCTION_CONSTRUCTOR;
        }
      }

      // Parse shorthand nested namespace declarations
      if (Skew.SymbolKind.isObject(kind)) {
        while (context.eat(Skew.TokenKind.DOT)) {
          var nextToken = context.current();

          if (!context.expect(Skew.TokenKind.IDENTIFIER)) {
            return false;
          }

          // Wrap this declaration in a namespace
          var nextParent = new Skew.ObjectSymbol(Skew.SymbolKind.OBJECT_NAMESPACE, name);
          nextParent.range = range;
          parent.objects.push(nextParent);
          parent = nextParent;

          // Update the declaration token
          nameToken = nextToken;
          range = nextToken.range;
          name = range.toString();
        }
      }

      // Parse the symbol body
      switch (kind) {
        case Skew.SymbolKind.VARIABLE_GLOBAL:
        case Skew.SymbolKind.VARIABLE_INSTANCE: {
          var variable1 = new Skew.VariableSymbol(kind, name);
          variable1.range = range;

          if (token.kind === Skew.TokenKind.CONST) {
            variable1.flags |= Skew.Symbol.IS_CONST;
          }

          if (Skew.Parsing.peekType(context)) {
            variable1.type = Skew.Parsing.typePratt.parse(context, Skew.Precedence.LOWEST);
          }

          if (context.eat(Skew.TokenKind.ASSIGN)) {
            variable1.value = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

            if (variable1.value === null) {
              return false;
            }

            Skew.Parsing.checkExtraParentheses(context, variable1.value);
          }

          parent.variables.push(variable1);
          symbol = variable1;
          break;
        }

        case Skew.SymbolKind.FUNCTION_ANNOTATION:
        case Skew.SymbolKind.FUNCTION_CONSTRUCTOR:
        case Skew.SymbolKind.FUNCTION_GLOBAL:
        case Skew.SymbolKind.FUNCTION_INSTANCE: {
          var $function = new Skew.FunctionSymbol(kind, name);
          $function.range = range;

          if (token.kind === Skew.TokenKind.OVER) {
            $function.flags |= Skew.Symbol.IS_OVER;
          }

          // Check for setters like "def foo=(x int) {}" but don't allow a space
          // between the name and the assignment operator
          if (kind !== Skew.SymbolKind.FUNCTION_ANNOTATION && nameToken.kind === Skew.TokenKind.IDENTIFIER && context.peek(Skew.TokenKind.ASSIGN) && context.current().range.start === nameToken.range.end) {
            $function.range = Skew.Range.span($function.range, context.next().range);
            $function.flags |= Skew.Symbol.IS_SETTER;
            $function.name += "=";
          }

          // Parse type parameters
          if (context.eat(Skew.TokenKind.START_PARAMETER_LIST)) {
            $function.parameters = Skew.Parsing.parseTypeParameters(context, Skew.SymbolKind.PARAMETER_FUNCTION);

            if ($function.parameters === null) {
              return false;
            }
          }

          // Parse function arguments
          var before = context.current();

          if (context.eat(Skew.TokenKind.LEFT_PARENTHESIS)) {
            if (!Skew.Parsing.parseFunctionArguments(context, $function)) {
              return false;
            }

            // Functions without arguments are "getters" and don't use parentheses
            if ($function.$arguments.length === 0) {
              context.log.syntaxErrorEmptyFunctionParentheses(context.spanSince(before.range));
            }
          }

          if (kind !== Skew.SymbolKind.FUNCTION_ANNOTATION && !Skew.Parsing.parseFunctionReturnTypeAndBlock(context, $function)) {
            return false;
          }

          // Don't mark operators as getters to avoid confusion with unary operators and compiler-generated call expressions
          if (!isOperator && $function.$arguments.length === 0) {
            $function.flags |= Skew.Symbol.IS_GETTER;
          }

          parent.functions.push($function);
          symbol = $function;
          break;
        }

        case Skew.SymbolKind.OBJECT_CLASS:
        case Skew.SymbolKind.OBJECT_ENUM:
        case Skew.SymbolKind.OBJECT_INTERFACE:
        case Skew.SymbolKind.OBJECT_NAMESPACE: {
          var object = new Skew.ObjectSymbol(kind, name);
          object.range = range;

          if (kind !== Skew.SymbolKind.OBJECT_NAMESPACE && context.eat(Skew.TokenKind.START_PARAMETER_LIST)) {
            object.parameters = Skew.Parsing.parseTypeParameters(context, Skew.SymbolKind.PARAMETER_OBJECT);

            if (object.parameters === null) {
              return false;
            }
          }

          if (context.eat(Skew.TokenKind.COLON)) {
            object.base = Skew.Parsing.typePratt.parse(context, Skew.Precedence.LOWEST);

            if (object.base === null) {
              return false;
            }
          }

          if (!context.expect(Skew.TokenKind.LEFT_BRACE)) {
            return false;
          }

          Skew.Parsing.parseSymbols(context, object, null);

          if (!context.expect(Skew.TokenKind.RIGHT_BRACE)) {
            return false;
          }

          parent.objects.push(object);
          symbol = object;
          break;
        }

        default: {
          assert(false);
          break;
        }
      }

      // Forbid certain kinds of symbols inside enums
      if (parent.kind === Skew.SymbolKind.OBJECT_ENUM && (kind === Skew.SymbolKind.FUNCTION_CONSTRUCTOR || kind === Skew.SymbolKind.VARIABLE_INSTANCE)) {
        context.log.syntaxErrorBadDeclarationInsideEnum(context.spanSince(token.range));
      }
    }

    symbol.annotations = annotations;
    symbol.comments = comments;
    comments = Skew.Parsing.parseTrailingComment(context, comments);

    if (comments !== null) {
      symbol.comments = comments;
      context.eat(Skew.TokenKind.NEWLINE);
    }

    else if (!Skew.Parsing.parseAfterBlock(context)) {
      return false;
    }

    return true;
  };

  Skew.Parsing.parseSymbols = function(context, parent, annotations) {
    context.eat(Skew.TokenKind.NEWLINE);

    while (!context.peek(Skew.TokenKind.END_OF_FILE) && !context.peek(Skew.TokenKind.RIGHT_BRACE)) {
      if (!Skew.Parsing.parseSymbol(context, parent, annotations)) {
        break;
      }
    }
  };

  Skew.Parsing.parseCommaSeparatedList = function(context, stop) {
    var values = [];

    while (!context.peek(stop)) {
      if (!(values.length === 0)) {
        if (!context.expect(Skew.TokenKind.COMMA)) {
          return null;
        }

        context.eat(Skew.TokenKind.NEWLINE);
      }

      var value = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);
      values.push(value);

      if (value === null) {
        break;
      }
    }

    if (!context.expect(stop)) {
      return null;
    }

    return values;
  };

  Skew.Parsing.parseHexCharacter = function(c) {
    if (c >= 48 && c <= 57) {
      return c - 48 | 0;
    }

    if (c >= 65 && c <= 70) {
      return (c - 65 | 0) + 10 | 0;
    }

    if (c >= 97 && c <= 102) {
      return (c - 97 | 0) + 10 | 0;
    }

    return -1;
  };

  Skew.Parsing.parseStringLiteral = function(log, range) {
    var text = range.toString();
    assert(text.length >= 2);
    assert(text.charCodeAt(0) === 34 || text.charCodeAt(0) === 39);
    assert(text.charCodeAt(text.length - 1 | 0) === text.charCodeAt(0));
    var builder = new StringBuilder();

    // Append long runs of unescaped characters using a single slice for speed
    var start = 1;
    var i = 1;

    while ((i + 1 | 0) < text.length) {
      var c = text.charCodeAt(i);
      ++i;

      if (c === 92) {
        var escape = i - 1 | 0;
        builder.append(text.slice(start, escape));

        if ((i + 1 | 0) < text.length) {
          c = text.charCodeAt(i);
          ++i;

          if (c === 110) {
            builder.append("\n");
            start = i;
          }

          else if (c === 114) {
            builder.append("\r");
            start = i;
          }

          else if (c === 116) {
            builder.append("\t");
            start = i;
          }

          else if (c === 101) {
            builder.append("\x1B");
            start = i;
          }

          else if (c === 48) {
            builder.append("\0");
            start = i;
          }

          else if (c === 92 || c === 34 || c === 39) {
            builder.append(String.fromCharCode(c));
            start = i;
          }

          else if (c === 120) {
            if ((i + 1 | 0) < text.length) {
              var c0 = Skew.Parsing.parseHexCharacter(text.charCodeAt(i));
              ++i;

              if ((i + 1 | 0) < text.length) {
                var c1 = Skew.Parsing.parseHexCharacter(text.charCodeAt(i));
                ++i;

                if (c0 !== -1 && c1 !== -1) {
                  builder.append(String.fromCharCode(c0 << 4 | c1));
                  start = i;
                }
              }
            }
          }
        }

        if (start < i) {
          log.syntaxErrorInvalidEscapeSequence(new Skew.Range(range.source, range.start + escape | 0, range.start + i | 0));
        }
      }
    }

    builder.append(text.slice(start, i));
    return builder.toString();
  };

  Skew.Parsing.boolLiteral = function(value) {
    return function(context, token) {
      return new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.BoolContent(value)).withRange(token.range);
    };
  };

  Skew.Parsing.tokenLiteral = function(kind) {
    return function(context, token) {
      return new Skew.Node(kind).withRange(token.range);
    };
  };

  Skew.Parsing.unaryPrefix = function(kind) {
    return function(context, token, value) {
      return Skew.Node.createUnary(kind, value).withRange(Skew.Range.span(token.range, value.range)).withInternalRange(token.range);
    };
  };

  Skew.Parsing.unaryPostfix = function(kind) {
    return function(context, value, token) {
      return Skew.Node.createUnary(kind, value).withRange(Skew.Range.span(value.range, token.range)).withInternalRange(token.range);
    };
  };

  Skew.Parsing.binaryInfix = function(kind) {
    return function(context, left, token, right) {
      if (kind === Skew.NodeKind.ASSIGN && left.kind === Skew.NodeKind.INDEX) {
        left.appendChild(right);
        left.kind = Skew.NodeKind.ASSIGN_INDEX;
        return left.withRange(Skew.Range.span(left.range, right.range)).withInternalRange(Skew.Range.span(left.internalRange, right.range));
      }

      return Skew.Node.createBinary(kind, left, right).withRange(Skew.Range.span(left.range, right.range)).withInternalRange(token.range);
    };
  };

  Skew.Parsing.createExpressionParser = function() {
    var pratt = new Skew.Pratt();
    pratt.literal(Skew.TokenKind.DOUBLE, function(context, token) {
      return new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.DoubleContent(+token.range.toString())).withRange(token.range);
    });
    pratt.literal(Skew.TokenKind.FALSE, Skew.Parsing.boolLiteral(false));
    pratt.literal(Skew.TokenKind.INT, Skew.Parsing.intLiteral);
    pratt.literal(Skew.TokenKind.INT_BINARY, Skew.Parsing.intLiteral);
    pratt.literal(Skew.TokenKind.INT_HEX, Skew.Parsing.intLiteral);
    pratt.literal(Skew.TokenKind.INT_OCTAL, Skew.Parsing.intLiteral);
    pratt.literal(Skew.TokenKind.NULL, Skew.Parsing.tokenLiteral(Skew.NodeKind.NULL));
    pratt.literal(Skew.TokenKind.STRING, Skew.Parsing.stringLiteral);
    pratt.literal(Skew.TokenKind.SUPER, Skew.Parsing.tokenLiteral(Skew.NodeKind.SUPER));
    pratt.literal(Skew.TokenKind.TRUE, Skew.Parsing.boolLiteral(true));
    pratt.literal(Skew.TokenKind.CHARACTER, function(context, token) {
      var result = Skew.Parsing.parseStringLiteral(context.log, token.range);
      var codePoint = 0;

      // There must be exactly one unicode code point
      var iterator = Unicode.StringIterator.INSTANCE.reset(result, 0);
      codePoint = iterator.nextCodePoint();

      if (codePoint === -1 || iterator.nextCodePoint() !== -1) {
        context.log.syntaxErrorInvalidCharacter(token.range);
      }

      // Don't return null when there's an error because that
      // error won't affect the rest of the compilation
      return new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.IntContent(codePoint)).withRange(token.range);
    });
    pratt.prefix(Skew.TokenKind.MINUS, Skew.Precedence.UNARY_PREFIX, Skew.Parsing.unaryPrefix(Skew.NodeKind.NEGATIVE));
    pratt.prefix(Skew.TokenKind.NOT, Skew.Precedence.UNARY_PREFIX, Skew.Parsing.unaryPrefix(Skew.NodeKind.NOT));
    pratt.prefix(Skew.TokenKind.PLUS, Skew.Precedence.UNARY_PREFIX, Skew.Parsing.unaryPrefix(Skew.NodeKind.POSITIVE));
    pratt.prefix(Skew.TokenKind.TILDE, Skew.Precedence.UNARY_PREFIX, Skew.Parsing.unaryPrefix(Skew.NodeKind.COMPLEMENT));
    pratt.prefix(Skew.TokenKind.INCREMENT, Skew.Precedence.UNARY_PREFIX, Skew.Parsing.unaryPrefix(Skew.NodeKind.INCREMENT));
    pratt.prefix(Skew.TokenKind.DECREMENT, Skew.Precedence.UNARY_PREFIX, Skew.Parsing.unaryPrefix(Skew.NodeKind.DECREMENT));
    pratt.postfix(Skew.TokenKind.INCREMENT, Skew.Precedence.UNARY_PREFIX, Skew.Parsing.unaryPostfix(Skew.NodeKind.INCREMENT));
    pratt.postfix(Skew.TokenKind.DECREMENT, Skew.Precedence.UNARY_PREFIX, Skew.Parsing.unaryPostfix(Skew.NodeKind.DECREMENT));
    pratt.infix(Skew.TokenKind.BITWISE_AND, Skew.Precedence.BITWISE_AND, Skew.Parsing.binaryInfix(Skew.NodeKind.BITWISE_AND));
    pratt.infix(Skew.TokenKind.BITWISE_OR, Skew.Precedence.BITWISE_OR, Skew.Parsing.binaryInfix(Skew.NodeKind.BITWISE_OR));
    pratt.infix(Skew.TokenKind.BITWISE_XOR, Skew.Precedence.BITWISE_XOR, Skew.Parsing.binaryInfix(Skew.NodeKind.BITWISE_XOR));
    pratt.infix(Skew.TokenKind.COMPARE, Skew.Precedence.COMPARE, Skew.Parsing.binaryInfix(Skew.NodeKind.COMPARE));
    pratt.infix(Skew.TokenKind.DIVIDE, Skew.Precedence.MULTIPLY, Skew.Parsing.binaryInfix(Skew.NodeKind.DIVIDE));
    pratt.infix(Skew.TokenKind.EQUAL, Skew.Precedence.EQUAL, Skew.Parsing.binaryInfix(Skew.NodeKind.EQUAL));
    pratt.infix(Skew.TokenKind.GREATER_THAN, Skew.Precedence.COMPARE, Skew.Parsing.binaryInfix(Skew.NodeKind.GREATER_THAN));
    pratt.infix(Skew.TokenKind.GREATER_THAN_OR_EQUAL, Skew.Precedence.COMPARE, Skew.Parsing.binaryInfix(Skew.NodeKind.GREATER_THAN_OR_EQUAL));
    pratt.infix(Skew.TokenKind.IN, Skew.Precedence.COMPARE, Skew.Parsing.binaryInfix(Skew.NodeKind.IN));
    pratt.infix(Skew.TokenKind.IS, Skew.Precedence.COMPARE, Skew.Parsing.binaryInfix(Skew.NodeKind.IS));
    pratt.infix(Skew.TokenKind.LESS_THAN, Skew.Precedence.COMPARE, Skew.Parsing.binaryInfix(Skew.NodeKind.LESS_THAN));
    pratt.infix(Skew.TokenKind.LESS_THAN_OR_EQUAL, Skew.Precedence.COMPARE, Skew.Parsing.binaryInfix(Skew.NodeKind.LESS_THAN_OR_EQUAL));
    pratt.infix(Skew.TokenKind.LOGICAL_AND, Skew.Precedence.LOGICAL_AND, Skew.Parsing.binaryInfix(Skew.NodeKind.LOGICAL_AND));
    pratt.infix(Skew.TokenKind.LOGICAL_OR, Skew.Precedence.LOGICAL_OR, Skew.Parsing.binaryInfix(Skew.NodeKind.LOGICAL_OR));
    pratt.infix(Skew.TokenKind.MINUS, Skew.Precedence.ADD, Skew.Parsing.binaryInfix(Skew.NodeKind.SUBTRACT));
    pratt.infix(Skew.TokenKind.MULTIPLY, Skew.Precedence.MULTIPLY, Skew.Parsing.binaryInfix(Skew.NodeKind.MULTIPLY));
    pratt.infix(Skew.TokenKind.NOT_EQUAL, Skew.Precedence.EQUAL, Skew.Parsing.binaryInfix(Skew.NodeKind.NOT_EQUAL));
    pratt.infix(Skew.TokenKind.PLUS, Skew.Precedence.ADD, Skew.Parsing.binaryInfix(Skew.NodeKind.ADD));
    pratt.infix(Skew.TokenKind.POWER, Skew.Precedence.UNARY_PREFIX, Skew.Parsing.binaryInfix(Skew.NodeKind.POWER));
    pratt.infix(Skew.TokenKind.REMAINDER, Skew.Precedence.MULTIPLY, Skew.Parsing.binaryInfix(Skew.NodeKind.REMAINDER));
    pratt.infix(Skew.TokenKind.SHIFT_LEFT, Skew.Precedence.SHIFT, Skew.Parsing.binaryInfix(Skew.NodeKind.SHIFT_LEFT));
    pratt.infix(Skew.TokenKind.SHIFT_RIGHT, Skew.Precedence.SHIFT, Skew.Parsing.binaryInfix(Skew.NodeKind.SHIFT_RIGHT));
    pratt.infixRight(Skew.TokenKind.ASSIGN, Skew.Precedence.ASSIGN, Skew.Parsing.binaryInfix(Skew.NodeKind.ASSIGN));
    pratt.infixRight(Skew.TokenKind.ASSIGN_BITWISE_AND, Skew.Precedence.ASSIGN, Skew.Parsing.binaryInfix(Skew.NodeKind.ASSIGN_BITWISE_AND));
    pratt.infixRight(Skew.TokenKind.ASSIGN_BITWISE_OR, Skew.Precedence.ASSIGN, Skew.Parsing.binaryInfix(Skew.NodeKind.ASSIGN_BITWISE_OR));
    pratt.infixRight(Skew.TokenKind.ASSIGN_BITWISE_XOR, Skew.Precedence.ASSIGN, Skew.Parsing.binaryInfix(Skew.NodeKind.ASSIGN_BITWISE_XOR));
    pratt.infixRight(Skew.TokenKind.ASSIGN_DIVIDE, Skew.Precedence.ASSIGN, Skew.Parsing.binaryInfix(Skew.NodeKind.ASSIGN_DIVIDE));
    pratt.infixRight(Skew.TokenKind.ASSIGN_MINUS, Skew.Precedence.ASSIGN, Skew.Parsing.binaryInfix(Skew.NodeKind.ASSIGN_SUBTRACT));
    pratt.infixRight(Skew.TokenKind.ASSIGN_MULTIPLY, Skew.Precedence.ASSIGN, Skew.Parsing.binaryInfix(Skew.NodeKind.ASSIGN_MULTIPLY));
    pratt.infixRight(Skew.TokenKind.ASSIGN_PLUS, Skew.Precedence.ASSIGN, Skew.Parsing.binaryInfix(Skew.NodeKind.ASSIGN_ADD));
    pratt.infixRight(Skew.TokenKind.ASSIGN_POWER, Skew.Precedence.ASSIGN, Skew.Parsing.binaryInfix(Skew.NodeKind.ASSIGN_POWER));
    pratt.infixRight(Skew.TokenKind.ASSIGN_REMAINDER, Skew.Precedence.ASSIGN, Skew.Parsing.binaryInfix(Skew.NodeKind.ASSIGN_REMAINDER));
    pratt.infixRight(Skew.TokenKind.ASSIGN_SHIFT_LEFT, Skew.Precedence.ASSIGN, Skew.Parsing.binaryInfix(Skew.NodeKind.ASSIGN_SHIFT_LEFT));
    pratt.infixRight(Skew.TokenKind.ASSIGN_SHIFT_RIGHT, Skew.Precedence.ASSIGN, Skew.Parsing.binaryInfix(Skew.NodeKind.ASSIGN_SHIFT_RIGHT));
    pratt.parselet(Skew.TokenKind.DOT, Skew.Precedence.MEMBER).infix = Skew.Parsing.dotInfixParselet;
    pratt.parselet(Skew.TokenKind.INDEX, Skew.Precedence.LOWEST).prefix = Skew.Parsing.initializerParselet;
    pratt.parselet(Skew.TokenKind.LEFT_BRACE, Skew.Precedence.LOWEST).prefix = Skew.Parsing.initializerParselet;
    pratt.parselet(Skew.TokenKind.LEFT_BRACKET, Skew.Precedence.LOWEST).prefix = Skew.Parsing.initializerParselet;
    pratt.parselet(Skew.TokenKind.LIST_NEW, Skew.Precedence.LOWEST).prefix = Skew.Parsing.initializerParselet;
    pratt.parselet(Skew.TokenKind.SET_NEW, Skew.Precedence.LOWEST).prefix = Skew.Parsing.initializerParselet;
    pratt.parselet(Skew.TokenKind.START_PARAMETER_LIST, Skew.Precedence.MEMBER).infix = Skew.Parsing.parameterizedParselet;

    // Lambda expressions like "=> x"
    pratt.parselet(Skew.TokenKind.ARROW, Skew.Precedence.LOWEST).prefix = function(context) {
      var token = context.current();
      var symbol = new Skew.FunctionSymbol(Skew.SymbolKind.FUNCTION_LOCAL, "<lambda>");

      if (!Skew.Parsing.parseFunctionBlock(context, symbol)) {
        return null;
      }

      symbol.range = context.spanSince(token.range);
      return Skew.Node.createLambda(symbol).withRange(symbol.range);
    };

    // Cast expressions
    pratt.parselet(Skew.TokenKind.AS, Skew.Precedence.UNARY_PREFIX).infix = function(context, left) {
      var token = context.next();
      var type = Skew.Parsing.typePratt.parse(context, Skew.Precedence.LOWEST);

      if (type === null) {
        return null;
      }

      return Skew.Node.createCast(left, type).withRange(context.spanSince(left.range)).withInternalRange(token.range);
    };

    // Using "." as a unary prefix operator accesses members off the inferred type
    pratt.parselet(Skew.TokenKind.DOT, Skew.Precedence.MEMBER).prefix = function(context) {
      var token = context.next();
      var range = context.current().range;

      if (!context.expect(Skew.TokenKind.IDENTIFIER)) {
        return null;
      }

      return new Skew.Node(Skew.NodeKind.DOT).withContent(new Skew.StringContent(range.toString())).withChildren([null]).withRange(context.spanSince(token.range)).withInternalRange(range);
    };

    // Access members off of "dynamic" for untyped globals
    pratt.parselet(Skew.TokenKind.DYNAMIC, Skew.Precedence.LOWEST).prefix = function(context) {
      var token = context.next();

      if (!context.expect(Skew.TokenKind.DOT)) {
        return null;
      }

      var range = context.current().range;

      if (!context.expect(Skew.TokenKind.IDENTIFIER)) {
        return null;
      }

      return new Skew.Node(Skew.NodeKind.DOT).withContent(new Skew.StringContent(range.toString())).withChildren([new Skew.Node(Skew.NodeKind.DYNAMIC)]).withRange(context.spanSince(token.range)).withInternalRange(range);
    };

    // Name expressions and lambda| expressions like "x => x * x"
    pratt.parselet(Skew.TokenKind.IDENTIFIER, Skew.Precedence.LOWEST).prefix = function(context) {
      var range = context.next().range;
      var name = range.toString();

      if (context.peek(Skew.TokenKind.ARROW)) {
        var symbol = new Skew.FunctionSymbol(Skew.SymbolKind.FUNCTION_LOCAL, "<lambda>");
        var argument = new Skew.VariableSymbol(Skew.SymbolKind.VARIABLE_LOCAL, name);
        argument.range = range;
        symbol.$arguments.push(argument);

        if (!Skew.Parsing.parseFunctionBlock(context, symbol)) {
          return null;
        }

        symbol.range = context.spanSince(range);
        return Skew.Node.createLambda(symbol).withRange(symbol.range);
      }

      return new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent(name)).withRange(range);
    };

    // Index expressions
    pratt.parselet(Skew.TokenKind.LEFT_BRACKET, Skew.Precedence.MEMBER).infix = function(context, left) {
      var token = context.next();
      var $arguments = Skew.Parsing.parseCommaSeparatedList(context, Skew.TokenKind.RIGHT_BRACKET);

      if ($arguments === null) {
        return null;
      }

      return Skew.Node.createIndex(left, $arguments).withRange(context.spanSince(left.range)).withInternalRange(context.spanSince(token.range));
    };

    // Parenthetic groups and lambda expressions like "() => x"
    pratt.parselet(Skew.TokenKind.LEFT_PARENTHESIS, Skew.Precedence.LOWEST).prefix = function(context) {
      var token = context.next();

      // Try to parse a group
      if (!context.peek(Skew.TokenKind.RIGHT_PARENTHESIS)) {
        var value = pratt.parse(context, Skew.Precedence.LOWEST);

        if (value === null) {
          return null;
        }

        if ((value.kind !== Skew.NodeKind.NAME || !Skew.Parsing.peekType(context)) && context.eat(Skew.TokenKind.RIGHT_PARENTHESIS)) {
          if (value.kind !== Skew.NodeKind.NAME || !context.peek(Skew.TokenKind.ARROW)) {
            return value.withRange(context.spanSince(token.range)).withFlags(Skew.Node.IS_INSIDE_PARENTHESES);
          }

          context.undo();
        }

        context.undo();
      }

      // Parse a lambda instead
      var symbol = new Skew.FunctionSymbol(Skew.SymbolKind.FUNCTION_LOCAL, "<lambda>");

      if (!Skew.Parsing.parseFunctionArguments(context, symbol) || !Skew.Parsing.parseFunctionReturnTypeAndBlock(context, symbol)) {
        return null;
      }

      symbol.range = context.spanSince(token.range);
      return Skew.Node.createLambda(symbol).withRange(symbol.range);
    };

    // Call expressions
    pratt.parselet(Skew.TokenKind.LEFT_PARENTHESIS, Skew.Precedence.UNARY_POSTFIX).infix = function(context, left) {
      var token = context.next();
      var $arguments = Skew.Parsing.parseCommaSeparatedList(context, Skew.TokenKind.RIGHT_PARENTHESIS);

      if ($arguments === null) {
        return null;
      }

      return Skew.Node.createCall(left, $arguments).withRange(context.spanSince(left.range)).withInternalRange(context.spanSince(token.range));
    };

    // Hook expressions
    pratt.parselet(Skew.TokenKind.QUESTION_MARK, Skew.Precedence.ASSIGN).infix = function(context, left) {
      context.next();
      var middle = pratt.parse(context, Skew.Precedence.ASSIGN - 1 | 0);

      if (middle === null || !context.expect(Skew.TokenKind.COLON)) {
        return null;
      }

      var right = pratt.parse(context, Skew.Precedence.ASSIGN - 1 | 0);

      if (right === null) {
        return null;
      }

      return Skew.Node.createHook(left, middle, right).withRange(context.spanSince(left.range));
    };
    return pratt;
  };

  Skew.Parsing.createTypeParser = function() {
    var pratt = new Skew.Pratt();
    pratt.literal(Skew.TokenKind.DYNAMIC, Skew.Parsing.tokenLiteral(Skew.NodeKind.DYNAMIC));
    pratt.parselet(Skew.TokenKind.DOT, Skew.Precedence.MEMBER).infix = Skew.Parsing.dotInfixParselet;
    pratt.parselet(Skew.TokenKind.START_PARAMETER_LIST, Skew.Precedence.MEMBER).infix = Skew.Parsing.parameterizedParselet;

    // Name expressions or lambda type expressions like "fn(int) int"
    pratt.parselet(Skew.TokenKind.IDENTIFIER, Skew.Precedence.LOWEST).prefix = function(context) {
      var token = context.next();
      var name = token.range.toString();

      if (name !== "fn" || !context.eat(Skew.TokenKind.LEFT_PARENTHESIS)) {
        return new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent(name)).withRange(token.range);
      }

      // Parse argument types
      var argTypes = [];

      while (!context.eat(Skew.TokenKind.RIGHT_PARENTHESIS)) {
        if (!(argTypes.length === 0) && !context.expect(Skew.TokenKind.COMMA)) {
          return null;
        }

        var type = Skew.Parsing.typePratt.parse(context, Skew.Precedence.LOWEST);

        if (type === null) {
          return null;
        }

        argTypes.push(type);
      }

      var returnType = null;

      // Parse return type if present
      if (Skew.Parsing.peekType(context)) {
        returnType = Skew.Parsing.typePratt.parse(context, Skew.Precedence.LOWEST);

        if (returnType === null) {
          return null;
        }
      }

      return Skew.Node.createLambdaType(argTypes, returnType).withRange(context.spanSince(token.range));
    };
    return pratt;
  };

  Skew.Parsing.intLiteral = function(context, token) {
    return new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.IntContent(Skew.Parsing.parseIntLiteral(token.range.toString()).value)).withRange(token.range);
  };

  Skew.Parsing.stringLiteral = function(context, token) {
    return new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.StringContent(Skew.Parsing.parseStringLiteral(context.log, token.range))).withRange(token.range);
  };

  Skew.ParserContext = function(log, tokens) {
    var self = this;
    self.log = log;
    self.inNonVoidFunction = false;
    self.needsPreprocessor = false;
    self.tokens = tokens;
    self.index = 0;
    self.previousSyntaxError = null;
  };

  Skew.ParserContext.prototype.current = function() {
    var self = this;
    return self.tokens[self.index];
  };

  Skew.ParserContext.prototype.next = function() {
    var self = this;
    var token = self.current();

    if ((self.index + 1 | 0) < self.tokens.length) {
      ++self.index;
    }

    return token;
  };

  Skew.ParserContext.prototype.spanSince = function(range) {
    var self = this;
    var previous = self.tokens[self.index > 0 ? self.index - 1 | 0 : 0];
    return previous.range.end < range.start ? range : Skew.Range.span(range, previous.range);
  };

  Skew.ParserContext.prototype.peek = function(kind) {
    var self = this;
    return self.current().kind === kind;
  };

  Skew.ParserContext.prototype.eat = function(kind) {
    var self = this;

    if (self.peek(kind)) {
      self.next();
      return true;
    }

    return false;
  };

  Skew.ParserContext.prototype.undo = function() {
    var self = this;
    assert(self.index > 0);
    --self.index;
  };

  Skew.ParserContext.prototype.expect = function(kind) {
    var self = this;

    if (!self.eat(kind)) {
      var token = self.current();

      if (self.previousSyntaxError !== token) {
        var range = token.range;
        self.log.syntaxErrorExpectedToken(range, token.kind, kind);
        self.previousSyntaxError = token;
      }

      return false;
    }

    return true;
  };

  Skew.ParserContext.prototype.unexpectedToken = function() {
    var self = this;
    var token = self.current();

    if (self.previousSyntaxError !== token) {
      self.log.syntaxErrorUnexpectedToken(token);
      self.previousSyntaxError = token;
    }
  };

  Skew.Parselet = function(precedence) {
    var self = this;
    self.precedence = precedence;
    self.prefix = null;
    self.infix = null;
  };

  // A Pratt parser is a parser that associates up to two operations per token,
  // each with its own precedence. Pratt parsers excel at parsing expression
  // trees with deeply nested precedence levels. For an excellent writeup, see:
  //
  //   http://journal.stuffwithstuff.com/2011/03/19/pratt-parsers-expression-parsing-made-easy/
  //
  Skew.Pratt = function() {
    var self = this;
    self.table = Object.create(null);
  };

  Skew.Pratt.prototype.parselet = function(kind, precedence) {
    var self = this;
    var parselet = in_IntMap.get(self.table, kind, null);

    if (parselet === null) {
      var created = new Skew.Parselet(precedence);
      parselet = created;
      self.table[kind] = created;
    }

    else if (precedence > parselet.precedence) {
      parselet.precedence = precedence;
    }

    return parselet;
  };

  Skew.Pratt.prototype.parse = function(context, precedence) {
    var self = this;
    var token = context.current();
    var parselet = in_IntMap.get(self.table, token.kind, null);

    if (parselet === null || parselet.prefix === null) {
      context.unexpectedToken();
      return null;
    }

    var node = self.resume(context, precedence, parselet.prefix(context));

    // Parselets must set the range of every node
    assert(node === null || node.range !== null);
    return node;
  };

  Skew.Pratt.prototype.resume = function(context, precedence, left) {
    var self = this;

    while (left !== null) {
      var kind = context.current().kind;
      var parselet = in_IntMap.get(self.table, kind, null);

      if (parselet === null || parselet.infix === null || parselet.precedence <= precedence) {
        break;
      }

      left = parselet.infix(context, left);

      // Parselets must set the range of every node
      assert(left === null || left.range !== null);
    }

    return left;
  };

  Skew.Pratt.prototype.literal = function(kind, callback) {
    var self = this;
    self.parselet(kind, Skew.Precedence.LOWEST).prefix = function(context) {
      return callback(context, context.next());
    };
  };

  Skew.Pratt.prototype.prefix = function(kind, precedence, callback) {
    var self = this;
    self.parselet(kind, Skew.Precedence.LOWEST).prefix = function(context) {
      var token = context.next();
      var value = self.parse(context, precedence);
      return value !== null ? callback(context, token, value) : null;
    };
  };

  Skew.Pratt.prototype.postfix = function(kind, precedence, callback) {
    var self = this;
    self.parselet(kind, precedence).infix = function(context, left) {
      return callback(context, left, context.next());
    };
  };

  Skew.Pratt.prototype.infix = function(kind, precedence, callback) {
    var self = this;
    self.parselet(kind, precedence).infix = function(context, left) {
      var token = context.next();
      var right = self.parse(context, precedence);
      return right !== null ? callback(context, left, token, right) : null;
    };
  };

  Skew.Pratt.prototype.infixRight = function(kind, precedence, callback) {
    var self = this;
    self.parselet(kind, precedence).infix = function(context, left) {
      var token = context.next();

      // Subtract 1 for right-associativity
      var right = self.parse(context, precedence - 1 | 0);
      return right !== null ? callback(context, left, token, right) : null;
    };
  };

  Skew.FormattedRange = function(line, range) {
    var self = this;
    self.line = line;
    self.range = range;
  };

  Skew.Range = function(source, start, end) {
    var self = this;
    self.source = source;
    self.start = start;
    self.end = end;
  };

  Skew.Range.prototype.toString = function() {
    var self = this;
    return self.source.contents.slice(self.start, self.end);
  };

  Skew.Range.prototype.locationString = function() {
    var self = this;
    var location = self.source.indexToLineColumn(self.start);
    return self.source.name + ":" + (location.line + 1 | 0).toString() + ":" + (location.column + 1 | 0).toString();
  };

  Skew.Range.prototype.format = function(maxLength) {
    var self = this;
    assert(self.source !== null);
    var start = self.source.indexToLineColumn(self.start);
    var end = self.source.indexToLineColumn(self.end);
    var line = self.source.contentsOfLine(start.line);
    var length = line.length;

    // Use a unicode iterator to count the actual code points so they don't get sliced through the middle
    var iterator = Unicode.StringIterator.INSTANCE.reset(line, 0);
    var a = iterator.countCodePointsUntil(start.column);
    var b = a + iterator.countCodePointsUntil(end.line === start.line ? end.column : length) | 0;
    var count = b + iterator.countCodePointsUntil(length) | 0;

    // Ensure the line length doesn't exceed maxLength
    if (maxLength > 0 && count > maxLength) {
      var centeredWidth = Math.min(b - a | 0, maxLength / 2 | 0);
      var centeredStart = Math.max((maxLength - centeredWidth | 0) / 2 | 0, 3);
      var codePoints = in_string.codePoints(line);

      // Left aligned
      if (a < centeredStart) {
        line = in_string.fromCodePoints(codePoints.slice(0, maxLength - 3 | 0)) + "...";

        if (b > (maxLength - 3 | 0)) {
          b = maxLength - 3 | 0;
        }
      }

      // Right aligned
      else if ((count - a | 0) < (maxLength - centeredStart | 0)) {
        var offset = count - maxLength | 0;
        line = "..." + in_string.fromCodePoints(codePoints.slice(offset + 3 | 0, count));
        a -= offset;
        b -= offset;
      }

      // Center aligned
      else {
        var offset1 = a - centeredStart | 0;
        line = "..." + in_string.fromCodePoints(codePoints.slice(offset1 + 3 | 0, (offset1 + maxLength | 0) - 3 | 0)) + "...";
        a -= offset1;
        b -= offset1;

        if (b > (maxLength - 3 | 0)) {
          b = maxLength - 3 | 0;
        }
      }
    }

    return new Skew.FormattedRange(line, in_string.repeat(" ", a) + ((b - a | 0) < 2 ? "^" : in_string.repeat("~", b - a | 0)));
  };

  Skew.Range.prototype.fromStart = function(count) {
    var self = this;
    assert(count >= 0 && count <= (self.end - self.start | 0));
    return new Skew.Range(self.source, self.start, self.start + count | 0);
  };

  Skew.Range.prototype.fromEnd = function(count) {
    var self = this;
    assert(count >= 0 && count <= (self.end - self.start | 0));
    return new Skew.Range(self.source, self.end - count | 0, self.end);
  };

  Skew.Range.prototype.slice = function(offsetStart, offsetEnd) {
    var self = this;
    assert(offsetStart >= 0 && offsetStart <= offsetEnd && offsetEnd <= (self.end - self.start | 0));
    return new Skew.Range(self.source, self.start + offsetStart | 0, self.start + offsetEnd | 0);
  };

  Skew.Range.span = function(start, end) {
    assert(start.source === end.source);
    assert(start.start <= end.end);
    return new Skew.Range(start.source, start.start, end.end);
  };

  Skew.LineColumn = function(line, column) {
    var self = this;
    self.line = line;
    self.column = column;
  };

  Skew.Source = function(name, contents) {
    var self = this;
    self.name = name;
    self.contents = contents;
    self.lineOffsets = null;
  };

  Skew.Source.prototype.entireRange = function() {
    var self = this;
    return new Skew.Range(self, 0, self.contents.length);
  };

  Skew.Source.prototype.contentsOfLine = function(line) {
    var self = this;
    self.computeLineOffsets();

    if (line < 0 || line >= self.lineOffsets.length) {
      return "";
    }

    var start = self.lineOffsets[line];
    var end = (line + 1 | 0) < self.lineOffsets.length ? self.lineOffsets[line + 1 | 0] - 1 | 0 : self.contents.length;
    return self.contents.slice(start, end);
  };

  Skew.Source.prototype.indexToLineColumn = function(index) {
    var self = this;
    self.computeLineOffsets();

    // Binary search to find the line
    var count = self.lineOffsets.length;
    var line = 0;

    while (count > 0) {
      var step = count / 2 | 0;
      var i = line + step | 0;

      if (self.lineOffsets[i] <= index) {
        line = i + 1 | 0;
        count = (count - step | 0) - 1 | 0;
      }

      else {
        count = step;
      }
    }

    // Use the line to compute the column
    var column = line > 0 ? index - self.lineOffsets[line - 1 | 0] | 0 : index;
    return new Skew.LineColumn(line - 1 | 0, column);
  };

  Skew.Source.prototype.computeLineOffsets = function() {
    var self = this;

    if (self.lineOffsets === null) {
      self.lineOffsets = [0];

      for (var i = 0, count = self.contents.length; i < count; ++i) {
        if (self.contents.charCodeAt(i) === 10) {
          self.lineOffsets.push(i + 1 | 0);
        }
      }
    }
  };

  Skew.Token = function(range, kind) {
    var self = this;
    self.range = range;
    self.kind = kind;
  };

  Skew.Token.prototype.firstCodeUnit = function() {
    var self = this;

    if (self.kind === Skew.TokenKind.END_OF_FILE) {
      return 0;
    }

    assert(self.range.start < self.range.source.contents.length);
    return self.range.source.contents.charCodeAt(self.range.start);
  };

  Skew.CallSite = function(callNode, enclosingFunction) {
    var self = this;
    self.callNode = callNode;
    self.enclosingFunction = enclosingFunction;
  };

  Skew.CallInfo = function(symbol) {
    var self = this;
    self.symbol = symbol;
    self.callSites = [];
  };

  Skew.CallGraph = function(global) {
    var self = this;
    self.callInfo = [];
    self.symbolToInfoIndex = Object.create(null);
    self.visitObject(global);
  };

  Skew.CallGraph.prototype.visitObject = function(symbol) {
    var self = this;

    for (var i = 0, list = symbol.objects, count = list.length; i < count; ++i) {
      var object = list[i];
      self.visitObject(object);
    }

    for (var i1 = 0, list1 = symbol.functions, count1 = list1.length; i1 < count1; ++i1) {
      var $function = list1[i1];
      self.recordCallSite($function, null, null);
      self.visitNode($function.block, $function);
    }

    for (var i2 = 0, list2 = symbol.variables, count2 = list2.length; i2 < count2; ++i2) {
      var variable = list2[i2];
      self.visitNode(variable.value, null);
    }
  };

  Skew.CallGraph.prototype.visitNode = function(node, context) {
    var self = this;

    if (node !== null) {
      if (node.children !== null) {
        for (var i = 0, list = node.children, count = list.length; i < count; ++i) {
          var child = list[i];
          self.visitNode(child, context);
        }
      }

      if (node.kind === Skew.NodeKind.CALL && node.symbol !== null) {
        assert(Skew.SymbolKind.isFunction(node.symbol.kind));
        self.recordCallSite(node.symbol.asFunctionSymbol(), node, context);
      }
    }
  };

  Skew.CallGraph.prototype.recordCallSite = function(symbol, node, context) {
    var self = this;
    var index = in_IntMap.get(self.symbolToInfoIndex, symbol.id, -1);
    var info = index < 0 ? new Skew.CallInfo(symbol) : self.callInfo[index];

    if (index < 0) {
      self.symbolToInfoIndex[symbol.id] = self.callInfo.length;
      self.callInfo.push(info);
    }

    if (node !== null) {
      info.callSites.push(new Skew.CallSite(node, context));
    }
  };

  Skew.CompilerTarget = {
    NONE: 0,
    JAVASCRIPT: 1,
    LISP_TREE: 2
  };

  Skew.Define = function(name, value) {
    var self = this;
    self.name = name;
    self.value = value;
  };

  Skew.CompilerOptions = function() {
    var self = this;
    self.defines = Object.create(null);
    self.foldAllConstants = false;
    self.globalizeAllFunctions = false;
    self.inlineAllFunctions = false;
    self.jsMangle = false;
    self.jsMinify = false;
    self.outputDirectory = "";
    self.outputFile = "";
    self.target = Skew.CompilerTarget.NONE;
  };

  Skew.CompilerOptions.prototype.define = function(name, value) {
    var self = this;
    var range = new Skew.Source("<internal>", "--define:" + name + "=" + value).entireRange();
    self.defines[name] = new Skew.Define(range.slice(9, 9 + name.length | 0), range.fromEnd(value.length));
  };

  Skew.CompilerResult = function() {
    var self = this;
    self.cache = new Skew.TypeCache();
    self.global = new Skew.ObjectSymbol(Skew.SymbolKind.OBJECT_GLOBAL, "<global>");
    self.outputs = null;
    self.totalTime = 0;
  };

  Skew.Folding = {};

  Skew.Folding.ConstantLookup = function() {
    var self = this;
  };

  Skew.Folding.ConstantFolder = function(cache, constantLookup) {
    var self = this;
    self.cache = cache;
    self.constantLookup = constantLookup;
  };

  Skew.Folding.ConstantFolder.prototype.visitObject = function(symbol) {
    var self = this;

    for (var i = 0, list = symbol.objects, count = list.length; i < count; ++i) {
      var object = list[i];
      self.visitObject(object);
    }

    for (var i1 = 0, list1 = symbol.functions, count1 = list1.length; i1 < count1; ++i1) {
      var $function = list1[i1];

      if ($function.block !== null) {
        self.foldConstants($function.block);
      }
    }

    for (var i2 = 0, list2 = symbol.variables, count2 = list2.length; i2 < count2; ++i2) {
      var variable = list2[i2];

      if (variable.value !== null) {
        self.foldConstants(variable.value);
      }
    }
  };

  // Use this instead of node.become(Node.createConstant(content)) to avoid more GC
  Skew.Folding.ConstantFolder.prototype.flatten = function(node, content) {
    var self = this;
    node.removeChildren();
    node.kind = Skew.NodeKind.CONSTANT;
    node.content = content;
    node.symbol = null;
  };

  // Use this instead of node.become(Node.createBool(value)) to avoid more GC
  Skew.Folding.ConstantFolder.prototype.flattenBool = function(node, value) {
    var self = this;
    assert(node.resolvedType === self.cache.boolType || node.resolvedType === Skew.Type.DYNAMIC);
    self.flatten(node, new Skew.BoolContent(value));
  };

  // Use this instead of node.become(Node.createInt(value)) to avoid more GC
  Skew.Folding.ConstantFolder.prototype.flattenInt = function(node, value) {
    var self = this;
    assert(node.resolvedType === self.cache.intType || node.resolvedType === Skew.Type.DYNAMIC);
    self.flatten(node, new Skew.IntContent(value));
  };

  // Use this instead of node.become(Node.createDouble(value)) to avoid more GC
  Skew.Folding.ConstantFolder.prototype.flattenDouble = function(node, value) {
    var self = this;
    assert(node.resolvedType === self.cache.doubleType || node.resolvedType === Skew.Type.DYNAMIC);
    self.flatten(node, new Skew.DoubleContent(value));
  };

  // Use this instead of node.become(Node.createString(value)) to avoid more GC
  Skew.Folding.ConstantFolder.prototype.flattenString = function(node, value) {
    var self = this;
    assert(node.resolvedType === self.cache.stringType || node.resolvedType === Skew.Type.DYNAMIC);
    self.flatten(node, new Skew.StringContent(value));
  };

  Skew.Folding.ConstantFolder.prototype.foldConstants = function(node) {
    var self = this;
    var kind = node.kind;

    // Transform "a + (b + c)" => "(a + b) + c" before operands are folded
    if (kind === Skew.NodeKind.ADD && node.resolvedType === self.cache.stringType && node.binaryLeft().resolvedType === self.cache.stringType && node.binaryRight().resolvedType === self.cache.stringType) {
      self.rotateStringConcatenation(node);
    }

    // Fold operands before folding this node
    var children = node.children;

    if (children !== null) {
      var n = children.length;

      for (var i = 0, count = n; i < count; ++i) {
        var child = children[(n - i | 0) - 1 | 0];

        if (child !== null) {
          self.foldConstants(child);
        }
      }
    }

    // Separating the case bodies into separate functions makes the JavaScript JIT go faster
    switch (kind) {
      case Skew.NodeKind.BLOCK: {
        self.foldBlock(node);
        break;
      }

      case Skew.NodeKind.CALL: {
        self.foldCall(node);
        break;
      }

      case Skew.NodeKind.CAST: {
        self.foldCast(node);
        break;
      }

      case Skew.NodeKind.DOT: {
        self.foldDot(node);
        break;
      }

      case Skew.NodeKind.HOOK: {
        self.foldHook(node);
        break;
      }

      case Skew.NodeKind.NAME: {
        self.foldName(node);
        break;
      }

      default: {
        if (Skew.NodeKind.isUnary(kind)) {
          self.foldUnary(node);
        }

        else if (Skew.NodeKind.isBinary(kind)) {
          self.foldBinary(node);
        }
        break;
      }
    }
  };

  Skew.Folding.ConstantFolder.prototype.rotateStringConcatenation = function(node) {
    var self = this;
    var left = node.binaryLeft();
    var right = node.binaryRight();
    assert(node.kind === Skew.NodeKind.ADD);
    assert(left.resolvedType === self.cache.stringType || left.resolvedType === Skew.Type.DYNAMIC);
    assert(right.resolvedType === self.cache.stringType || right.resolvedType === Skew.Type.DYNAMIC);

    if (right.kind === Skew.NodeKind.ADD) {
      var rightLeft = right.binaryLeft();
      var rightRight = right.binaryRight();
      assert(rightLeft.resolvedType === self.cache.stringType || rightLeft.resolvedType === Skew.Type.DYNAMIC);
      assert(rightRight.resolvedType === self.cache.stringType || rightRight.resolvedType === Skew.Type.DYNAMIC);
      left.swapWith(right);
      left.swapWith(rightRight);
      left.swapWith(rightLeft);
    }
  };

  Skew.Folding.ConstantFolder.prototype.foldStringConcatenation = function(node) {
    var self = this;
    var left = node.binaryLeft();
    var right = node.binaryRight();
    assert(left.resolvedType === self.cache.stringType || left.resolvedType === Skew.Type.DYNAMIC);
    assert(right.resolvedType === self.cache.stringType || right.resolvedType === Skew.Type.DYNAMIC);

    if (right.isString()) {
      // "a" + "b" => "ab"
      if (left.isString()) {
        self.flattenString(node, left.asString() + right.asString());
      }

      else if (left.kind === Skew.NodeKind.ADD) {
        var leftLeft = left.binaryLeft();
        var leftRight = left.binaryRight();
        assert(leftLeft.resolvedType === self.cache.stringType || leftLeft.resolvedType === Skew.Type.DYNAMIC);
        assert(leftRight.resolvedType === self.cache.stringType || leftRight.resolvedType === Skew.Type.DYNAMIC);

        // (a + "b") + "c" => a + "bc"
        if (leftRight.isString()) {
          self.flattenString(leftRight, leftRight.asString() + right.asString());
          node.become(left.remove());
        }
      }
    }
  };

  Skew.Folding.ConstantFolder.prototype.foldTry = function(node) {
    var self = this;
    var tryBlock = node.tryBlock();
    var finallyBlock = node.finallyBlock();

    // A try block without any statements cannot possibly throw
    if (!tryBlock.hasChildren()) {
      node.remove();
      return -1;
    }

    // No need to keep an empty finally block around
    if (finallyBlock !== null && !finallyBlock.hasChildren()) {
      finallyBlock.replaceWithNull();
      finallyBlock = null;
    }

    // Inline the contents of the try block into the parent if possible
    if (node.children.length === 2 && finallyBlock === null) {
      var replacements = tryBlock.removeChildren();
      node.replaceWithNodes(replacements);
      return replacements.length - 1 | 0;
    }

    return 0;
  };

  Skew.Folding.ConstantFolder.prototype.foldIf = function(node) {
    var self = this;
    var test = node.ifTest();
    var trueBlock = node.ifTrue();
    var falseBlock = node.ifFalse();

    // No reason to keep an empty "else" block
    if (falseBlock !== null && !falseBlock.hasChildren()) {
      falseBlock.replaceWithNull();
      falseBlock = null;
    }

    // Always true if statement
    if (test.isTrue()) {
      // Inline the contents of the true block
      var replacements = trueBlock.removeChildren();
      node.replaceWithNodes(replacements);
      return replacements.length - 1 | 0;
    }

    // Always false if statement
    else if (test.isFalse()) {
      // Remove entirely
      if (falseBlock === null) {
        node.remove();
        return -1;
      }

      // Inline the contents of the false block
      var replacements1 = falseBlock.removeChildren();
      node.replaceWithNodes(replacements1);
      return replacements1.length - 1 | 0;
    }

    // Remove if statements with empty true blocks
    else if (!trueBlock.hasChildren()) {
      // "if (a) {} else b;" => "if (!a) b;"
      if (falseBlock !== null && falseBlock.hasChildren()) {
        test.invertBooleanCondition(self.cache);
        trueBlock.swapWith(falseBlock);
        trueBlock.replaceWithNull();
      }

      // "if (a) {}" => ""
      else if (test.hasNoSideEffects()) {
        node.remove();
        return -1;
      }

      // "if (a) {}" => "a;"
      else {
        node.become(Skew.Node.createExpression(test.remove()));
      }
    }

    return 0;
  };

  Skew.Folding.ConstantFolder.prototype.foldSwitch = function(node) {
    var self = this;
    var children = node.children;
    var defaultCase = null;

    // Check for a default case
    for (var i = 1, count = children.length; i < count; ++i) {
      var child = children[i];

      if (child.children.length === 1) {
        defaultCase = child;
        break;
      }
    }

    // Remove the default case if it's empty
    if (defaultCase !== null && !defaultCase.caseBlock().hasChildren()) {
      defaultCase.remove();
      defaultCase = null;
    }

    // If the default case is missing, all other empty cases can be removed too
    if (defaultCase === null) {
      var n = children.length;

      for (var i1 = 1, count1 = n; i1 < count1; ++i1) {
        var child1 = children[n - i1 | 0];

        if (!child1.caseBlock().hasChildren()) {
          child1.remove();
        }
      }
    }

    // Replace "switch (foo) {}" with "foo;"
    if (node.children.length === 1) {
      var value = node.switchValue();
      node.replaceWith(Skew.Node.createExpression(value.remove()).withRange(node.range));
      return -1;
    }

    return 0;
  };

  Skew.Folding.ConstantFolder.prototype.foldVar = function(node) {
    var self = this;
    var symbol = node.symbol.asVariableSymbol();

    // Remove this symbol entirely if it's being inlined everywhere
    if (symbol.isConst() && self.constantLookup.constantForSymbol(symbol) !== null) {
      node.remove();
      return -1;
    }

    return 0;
  };

  Skew.Folding.ConstantFolder.prototype.foldBlock = function(node) {
    var self = this;
    var children = node.children;
    var i = 0;

    while (i < children.length) {
      var child = children[i];
      var kind = child.kind;

      // Remove everything after a jump
      if (Skew.NodeKind.isJump(kind)) {
        var j = children.length - 1 | 0;

        while (j > i) {
          node.removeChildAtIndex(j);
          --j;
        }

        break;
      }

      // Remove constants and "while false { ... }" entirely
      if (kind === Skew.NodeKind.EXPRESSION && child.expressionValue().hasNoSideEffects() || kind === Skew.NodeKind.WHILE && child.whileTest().isFalse()) {
        node.removeChildAtIndex(i);
        --i;
      }

      else if (kind === Skew.NodeKind.VAR) {
        i += self.foldVar(child);
      }

      // Remove unused try statements since they can cause deoptimizations
      else if (kind === Skew.NodeKind.TRY) {
        i += self.foldTry(child);
      }

      // Statically evaluate if statements where possible
      else if (kind === Skew.NodeKind.IF) {
        i += self.foldIf(child);
      }

      // Fold switch statements
      else if (kind === Skew.NodeKind.SWITCH) {
        i += self.foldSwitch(child);
      }

      ++i;
    }
  };

  Skew.Folding.ConstantFolder.prototype.foldDot = function(node) {
    var self = this;
    var symbol = node.symbol;

    // Only replace this with a constant if the target has no side effects.
    // This catches constants declared on imported types.
    if (symbol !== null && symbol.isConst() && (node.dotTarget() === null || node.dotTarget().hasNoSideEffects())) {
      var content = self.constantLookup.constantForSymbol(symbol.asVariableSymbol());

      if (content !== null) {
        self.flatten(node, content);
      }
    }
  };

  Skew.Folding.ConstantFolder.prototype.foldName = function(node) {
    var self = this;
    var symbol = node.symbol;

    // Don't fold loop variables since they aren't actually constant across loop iterations
    if (symbol !== null && symbol.isConst() && !symbol.isLoopVariable()) {
      var content = self.constantLookup.constantForSymbol(symbol.asVariableSymbol());

      if (content !== null) {
        self.flatten(node, content);
      }
    }
  };

  Skew.Folding.ConstantFolder.prototype.foldCall = function(node) {
    var self = this;

    if (node.kind === Skew.NodeKind.CALL) {
      var value = node.callValue();

      if (value.kind === Skew.NodeKind.DOT) {
        var target = value.dotTarget();

        if (target !== null && target.kind === Skew.NodeKind.CONSTANT && value.asString() === "toString") {
          var content = target.content;

          switch (content.kind()) {
            case Skew.ContentKind.BOOL: {
              self.flattenString(node, content.asBool().toString());
              break;
            }

            case Skew.ContentKind.INT: {
              self.flattenString(node, content.asInt().toString());
              break;
            }

            case Skew.ContentKind.STRING: {
              self.flattenString(node, content.asString());
              break;
            }
          }
        }
      }
    }
  };

  Skew.Folding.ConstantFolder.prototype.foldCast = function(node) {
    var self = this;
    var type = node.castType().resolvedType;
    var value = node.castValue();

    if (value.kind === Skew.NodeKind.CONSTANT) {
      var content = value.content;
      var kind = content.kind();

      // Cast "bool" values
      if (kind === Skew.ContentKind.BOOL) {
        if (type === self.cache.intType) {
          self.flattenInt(node, value.asBool() | 0);
        }

        else if (type === self.cache.doubleType) {
          self.flattenDouble(node, +value.asBool());
        }
      }

      // Cast "int" values
      else if (kind === Skew.ContentKind.INT) {
        if (type === self.cache.boolType) {
          self.flattenBool(node, !!value.asInt());
        }

        else if (type === self.cache.doubleType) {
          self.flattenDouble(node, value.asInt());
        }
      }

      // Cast "double" values
      else if (kind === Skew.ContentKind.DOUBLE) {
        if (type === self.cache.boolType) {
          self.flattenBool(node, !!value.asDouble());
        }

        else if (type === self.cache.intType) {
          self.flattenInt(node, value.asDouble() | 0);
        }
      }
    }
  };

  Skew.Folding.ConstantFolder.prototype.foldUnary = function(node) {
    var self = this;
    var value = node.unaryValue();
    var kind = node.kind;

    if (value.kind === Skew.NodeKind.CONSTANT) {
      var content = value.content;
      var contentKind = content.kind();

      // Fold "bool" values
      if (contentKind === Skew.ContentKind.BOOL) {
        if (kind === Skew.NodeKind.NOT) {
          self.flattenBool(node, !value.asBool());
        }
      }

      // Fold "int" values
      else if (contentKind === Skew.ContentKind.INT) {
        if (kind === Skew.NodeKind.POSITIVE) {
          self.flattenInt(node, +value.asInt());
        }

        else if (kind === Skew.NodeKind.NEGATIVE) {
          self.flattenInt(node, -value.asInt());
        }

        else if (kind === Skew.NodeKind.COMPLEMENT) {
          self.flattenInt(node, ~value.asInt());
        }
      }

      // Fold "float" or "double" values
      else if (contentKind === Skew.ContentKind.DOUBLE) {
        if (kind === Skew.NodeKind.POSITIVE) {
          self.flattenDouble(node, +value.asDouble());
        }

        else if (kind === Skew.NodeKind.NEGATIVE) {
          self.flattenDouble(node, -value.asDouble());
        }
      }
    }

    // Partial evaluation ("!!x" isn't necessarily "x" if we don't know the type)
    else if (kind === Skew.NodeKind.NOT && value.resolvedType !== Skew.Type.DYNAMIC) {
      switch (value.kind) {
        case Skew.NodeKind.NOT:
        case Skew.NodeKind.EQUAL:
        case Skew.NodeKind.NOT_EQUAL:
        case Skew.NodeKind.LOGICAL_OR:
        case Skew.NodeKind.LOGICAL_AND:
        case Skew.NodeKind.LESS_THAN:
        case Skew.NodeKind.GREATER_THAN:
        case Skew.NodeKind.LESS_THAN_OR_EQUAL:
        case Skew.NodeKind.GREATER_THAN_OR_EQUAL: {
          value.invertBooleanCondition(self.cache);
          node.become(value);
          break;
        }
      }
    }
  };

  Skew.Folding.ConstantFolder.prototype.foldConstantAddOrSubtract = function(node, variable, constant, delta) {
    var self = this;
    var isAdd = node.kind === Skew.NodeKind.ADD;
    var needsContentUpdate = delta !== 0;
    var isRightConstant = constant === node.binaryRight();
    var shouldNegateConstant = !isAdd && isRightConstant;
    var value = constant.asInt();

    // Make this an add for simplicity
    if (shouldNegateConstant) {
      value = -value;
    }

    // Include the delta from the parent node if present
    value += delta;

    // Apply addition identities
    if (value === 0) {
      node.become(variable.remove());
      return;
    }

    // Check for nested addition or subtraction
    if (variable.kind === Skew.NodeKind.ADD || variable.kind === Skew.NodeKind.SUBTRACT) {
      var left = variable.binaryLeft();
      var right = variable.binaryRight();
      assert(left.resolvedType === self.cache.intType || left.resolvedType === Skew.Type.DYNAMIC);
      assert(right.resolvedType === self.cache.intType || right.resolvedType === Skew.Type.DYNAMIC);

      // (a + 1) + 2 => a + 3
      var isLeftConstant = left.isInt();

      if (isLeftConstant || right.isInt()) {
        self.foldConstantAddOrSubtract(variable, isLeftConstant ? right : left, isLeftConstant ? left : right, value);
        node.become(variable);
        return;
      }
    }

    // Adjust the value so it has the correct sign
    if (shouldNegateConstant) {
      value = -value;
    }

    // The negative sign can often be removed by code transformation
    if (value < 0) {
      // a + -1 => a - 1
      // a - -1 => a + 1
      if (isRightConstant) {
        node.kind = isAdd ? Skew.NodeKind.SUBTRACT : Skew.NodeKind.ADD;
        value = -value;
        needsContentUpdate = true;
      }

      // -1 + a => a - 1
      else if (isAdd) {
        node.kind = Skew.NodeKind.SUBTRACT;
        value = -value;
        variable.swapWith(constant);
        needsContentUpdate = true;
      }
    }

    // Avoid extra allocations
    if (needsContentUpdate) {
      constant.content = new Skew.IntContent(value);
    }

    // Also handle unary negation on "variable"
    self.foldAddOrSubtract(node);
  };

  Skew.Folding.ConstantFolder.prototype.foldAddOrSubtract = function(node) {
    var self = this;
    var isAdd = node.kind === Skew.NodeKind.ADD;
    var left = node.binaryLeft();
    var right = node.binaryRight();

    // -a + b => b - a
    if (left.kind === Skew.NodeKind.NEGATIVE && isAdd) {
      left.become(left.unaryValue().replaceWithNull());
      left.swapWith(right);
      node.kind = Skew.NodeKind.SUBTRACT;
    }

    // a + -b => a - b
    // a - -b => a + b
    else if (right.kind === Skew.NodeKind.NEGATIVE) {
      right.become(right.unaryValue().replaceWithNull());
      node.kind = isAdd ? Skew.NodeKind.SUBTRACT : Skew.NodeKind.ADD;
    }
  };

  Skew.Folding.ConstantFolder.prototype.foldConstantMultiply = function(node, variable, constant) {
    var self = this;
    assert(constant.isInt());

    // Canonicalize multiplication order
    if (node.binaryLeft() === constant) {
      variable.swapWith(constant);
    }

    // Apply identities
    var value = constant.asInt();

    if (value === 0) {
      if (variable.hasNoSideEffects()) {
        node.become(constant.remove());
      }

      return;
    }

    if (value === 1) {
      node.become(variable.remove());
      return;
    }

    // Multiply by a power of 2 should be a left-shift operation, which is
    // more concise and always faster (or at least never slower) than the
    // alternative. Division can't be replaced by a right-shift operation
    // because that would lead to incorrect results for negative numbers.
    var shift = self.logBase2(value);

    if (shift !== -1) {
      constant.content = new Skew.IntContent(shift);
      node.kind = Skew.NodeKind.SHIFT_LEFT;
    }
  };

  Skew.Folding.ConstantFolder.prototype.foldBinaryWithConstant = function(node, left, right) {
    var self = this;

    // There are lots of other folding opportunities for most binary operators
    // here but those usually have a negligible performance and/or size impact
    // on the generated code and instead slow the compiler down. Only certain
    // ones are implemented below.
    switch (node.kind) {
      case Skew.NodeKind.LOGICAL_AND: {
        if (left.isFalse() || right.isTrue()) {
          node.become(left.remove());
        }

        else if (left.isTrue()) {
          node.become(right.remove());
        }
        break;
      }

      case Skew.NodeKind.LOGICAL_OR: {
        if (left.isTrue() || right.isFalse()) {
          node.become(left.remove());
        }

        else if (left.isFalse()) {
          node.become(right.remove());
        }
        break;
      }

      case Skew.NodeKind.ADD:
      case Skew.NodeKind.SUBTRACT: {
        if (left.isInt()) {
          self.foldConstantAddOrSubtract(node, right, left, 0);
        }

        else if (right.isInt()) {
          self.foldConstantAddOrSubtract(node, left, right, 0);
        }

        else {
          self.foldAddOrSubtract(node);
        }
        break;
      }

      case Skew.NodeKind.MULTIPLY: {
        if (left.isInt()) {
          self.foldConstantMultiply(node, right, left);
        }

        else if (right.isInt()) {
          self.foldConstantMultiply(node, left, right);
        }
        break;
      }
    }
  };

  Skew.Folding.ConstantFolder.prototype.foldBinary = function(node) {
    var self = this;
    var kind = node.kind;

    if (kind === Skew.NodeKind.ADD && node.resolvedType === self.cache.stringType) {
      self.foldStringConcatenation(node);
      return;
    }

    var left = node.binaryLeft();
    var right = node.binaryRight();

    if (left.kind === Skew.NodeKind.CONSTANT && right.kind === Skew.NodeKind.CONSTANT) {
      var leftContent = left.content;
      var rightContent = right.content;
      var leftKind = leftContent.kind();
      var rightKind = rightContent.kind();

      // Fold equality operators
      if (leftKind === Skew.ContentKind.STRING && rightKind === Skew.ContentKind.STRING) {
        switch (kind) {
          case Skew.NodeKind.EQUAL: {
            self.flattenBool(node, leftContent.asString() === rightContent.asString());
            break;
          }

          case Skew.NodeKind.NOT_EQUAL: {
            self.flattenBool(node, leftContent.asString() !== rightContent.asString());
            break;
          }

          case Skew.NodeKind.LESS_THAN: {
            self.flattenBool(node, leftContent.asString() < rightContent.asString());
            break;
          }

          case Skew.NodeKind.GREATER_THAN: {
            self.flattenBool(node, leftContent.asString() > rightContent.asString());
            break;
          }

          case Skew.NodeKind.LESS_THAN_OR_EQUAL: {
            self.flattenBool(node, leftContent.asString() <= rightContent.asString());
            break;
          }

          case Skew.NodeKind.GREATER_THAN_OR_EQUAL: {
            self.flattenBool(node, leftContent.asString() >= rightContent.asString());
            break;
          }
        }

        return;
      }

      // Fold "bool" values
      else if (leftKind === Skew.ContentKind.BOOL && rightKind === Skew.ContentKind.BOOL) {
        switch (kind) {
          case Skew.NodeKind.LOGICAL_AND: {
            self.flattenBool(node, leftContent.asBool() && rightContent.asBool());
            break;
          }

          case Skew.NodeKind.LOGICAL_OR: {
            self.flattenBool(node, leftContent.asBool() || rightContent.asBool());
            break;
          }

          case Skew.NodeKind.EQUAL: {
            self.flattenBool(node, leftContent.asBool() === rightContent.asBool());
            break;
          }

          case Skew.NodeKind.NOT_EQUAL: {
            self.flattenBool(node, leftContent.asBool() !== rightContent.asBool());
            break;
          }
        }

        return;
      }

      // Fold "int" values
      else if (leftKind === Skew.ContentKind.INT && rightKind === Skew.ContentKind.INT) {
        switch (kind) {
          case Skew.NodeKind.ADD: {
            self.flattenInt(node, leftContent.asInt() + rightContent.asInt() | 0);
            break;
          }

          case Skew.NodeKind.SUBTRACT: {
            self.flattenInt(node, leftContent.asInt() - rightContent.asInt() | 0);
            break;
          }

          case Skew.NodeKind.MULTIPLY: {
            self.flattenInt(node, __imul(leftContent.asInt(), rightContent.asInt()));
            break;
          }

          case Skew.NodeKind.DIVIDE: {
            self.flattenInt(node, leftContent.asInt() / rightContent.asInt() | 0);
            break;
          }

          case Skew.NodeKind.REMAINDER: {
            self.flattenInt(node, leftContent.asInt() % rightContent.asInt() | 0);
            break;
          }

          case Skew.NodeKind.SHIFT_LEFT: {
            self.flattenInt(node, leftContent.asInt() << rightContent.asInt());
            break;
          }

          case Skew.NodeKind.SHIFT_RIGHT: {
            self.flattenInt(node, leftContent.asInt() >> rightContent.asInt());
            break;
          }

          case Skew.NodeKind.BITWISE_AND: {
            self.flattenInt(node, leftContent.asInt() & rightContent.asInt());
            break;
          }

          case Skew.NodeKind.BITWISE_OR: {
            self.flattenInt(node, leftContent.asInt() | rightContent.asInt());
            break;
          }

          case Skew.NodeKind.BITWISE_XOR: {
            self.flattenInt(node, leftContent.asInt() ^ rightContent.asInt());
            break;
          }

          case Skew.NodeKind.EQUAL: {
            self.flattenBool(node, leftContent.asInt() === rightContent.asInt());
            break;
          }

          case Skew.NodeKind.NOT_EQUAL: {
            self.flattenBool(node, leftContent.asInt() !== rightContent.asInt());
            break;
          }

          case Skew.NodeKind.LESS_THAN: {
            self.flattenBool(node, leftContent.asInt() < rightContent.asInt());
            break;
          }

          case Skew.NodeKind.GREATER_THAN: {
            self.flattenBool(node, leftContent.asInt() > rightContent.asInt());
            break;
          }

          case Skew.NodeKind.LESS_THAN_OR_EQUAL: {
            self.flattenBool(node, leftContent.asInt() <= rightContent.asInt());
            break;
          }

          case Skew.NodeKind.GREATER_THAN_OR_EQUAL: {
            self.flattenBool(node, leftContent.asInt() >= rightContent.asInt());
            break;
          }
        }

        return;
      }

      // Fold "double" values
      else if (leftKind === Skew.ContentKind.DOUBLE && rightKind === Skew.ContentKind.DOUBLE) {
        switch (kind) {
          case Skew.NodeKind.ADD: {
            self.flattenDouble(node, leftContent.asDouble() + rightContent.asDouble());
            break;
          }

          case Skew.NodeKind.SUBTRACT: {
            self.flattenDouble(node, leftContent.asDouble() - rightContent.asDouble());
            break;
          }

          case Skew.NodeKind.MULTIPLY: {
            self.flattenDouble(node, leftContent.asDouble() * rightContent.asDouble());
            break;
          }

          case Skew.NodeKind.DIVIDE: {
            self.flattenDouble(node, leftContent.asDouble() / rightContent.asDouble());
            break;
          }

          case Skew.NodeKind.EQUAL: {
            self.flattenBool(node, leftContent.asDouble() === rightContent.asDouble());
            break;
          }

          case Skew.NodeKind.NOT_EQUAL: {
            self.flattenBool(node, leftContent.asDouble() !== rightContent.asDouble());
            break;
          }

          case Skew.NodeKind.LESS_THAN: {
            self.flattenBool(node, leftContent.asDouble() < rightContent.asDouble());
            break;
          }

          case Skew.NodeKind.GREATER_THAN: {
            self.flattenBool(node, leftContent.asDouble() > rightContent.asDouble());
            break;
          }

          case Skew.NodeKind.LESS_THAN_OR_EQUAL: {
            self.flattenBool(node, leftContent.asDouble() <= rightContent.asDouble());
            break;
          }

          case Skew.NodeKind.GREATER_THAN_OR_EQUAL: {
            self.flattenBool(node, leftContent.asDouble() >= rightContent.asDouble());
            break;
          }
        }

        return;
      }
    }

    self.foldBinaryWithConstant(node, left, right);
  };

  Skew.Folding.ConstantFolder.prototype.foldHook = function(node) {
    var self = this;
    var test = node.hookTest();

    if (test.isTrue()) {
      node.become(node.hookTrue().remove());
    }

    else if (test.isFalse()) {
      node.become(node.hookFalse().remove());
    }
  };

  // Returns the log2(value) or -1 if log2(value) is not an integer
  Skew.Folding.ConstantFolder.prototype.logBase2 = function(value) {
    var self = this;

    if (value < 1 || (value & value - 1) !== 0) {
      return -1;
    }

    var result = 0;

    while (value > 1) {
      value >>= 1;
      ++result;
    }

    return result;
  };

  Skew.Folding.ConstantCache = function() {
    var self = this;
    Skew.Folding.ConstantLookup.call(self);
    self.map = Object.create(null);
  };

  __extends(Skew.Folding.ConstantCache, Skew.Folding.ConstantLookup);

  Skew.Folding.ConstantCache.prototype.constantForSymbol = function(symbol) {
    var self = this;

    if (symbol.id in self.map) {
      return self.map[symbol.id];
    }

    var constant = null;
    var value = symbol.value;

    if (symbol.isConst() && value !== null) {
      switch (value.kind) {
        case Skew.NodeKind.CONSTANT: {
          constant = value.content;
          break;
        }

        case Skew.NodeKind.NAME:
        case Skew.NodeKind.DOT: {
          var target = value.symbol;

          if (target !== null && Skew.SymbolKind.isVariable(target.kind)) {
            constant = self.constantForSymbol(target.asVariableSymbol());
          }
          break;
        }
      }
    }

    self.map[symbol.id] = constant;
    return constant;
  };

  Skew.VirtualLookup = function(global) {
    var self = this;
    self.map = Object.create(null);
    self.visitObject(global);
  };

  Skew.VirtualLookup.prototype.isVirtual = function(symbol) {
    var self = this;
    return in_IntMap.get(self.map, symbol.id, false);
  };

  Skew.VirtualLookup.prototype.visitObject = function(symbol) {
    var self = this;

    for (var i = 0, list = symbol.objects, count = list.length; i < count; ++i) {
      var object = list[i];
      self.visitObject(object);
    }

    for (var i1 = 0, list1 = symbol.functions, count1 = list1.length; i1 < count1; ++i1) {
      var $function = list1[i1];
      self.visitFunction($function);
    }
  };

  Skew.VirtualLookup.prototype.visitFunction = function(symbol) {
    var self = this;

    if (symbol.overridden !== null) {
      self.map[symbol.overridden.id] = true;
      self.map[symbol.id] = true;
    }
  };

  Skew.Inlining = {};

  Skew.Inlining.inlineSymbol = function(graph, info) {
    if (!info.shouldInline) {
      return;
    }

    // Inlining nested functions first is more efficient because it results in
    // fewer inlining operations. This won't enter an infinite loop because
    // inlining for all such functions has already been disabled.
    for (var i1 = 0, list = info.bodyCalls, count = list.length; i1 < count; ++i1) {
      var bodyCall = list[i1];
      Skew.Inlining.inlineSymbol(graph, bodyCall);
    }

    for (var i = 0, count2 = info.callSites.length; i < count2; ++i) {
      var callSite = info.callSites[i];

      if (callSite !== null) {
        var node = callSite.callNode;
        assert(node.children.length === (info.symbol.$arguments.length + 1 | 0));

        // Make sure each call site is inlined once by setting the call site to
        // null. The call site isn't removed from the list since we don't want
        // to mess up the indices of another call to inlineSymbol further up
        // the call stack.
        info.callSites[i] = null;

        // If there are unused arguments, drop those expressions entirely if
        // they don't have side effects:
        //
        //   def bar(a int, b int) int {
        //     return a
        //   }
        //
        //   def test int {
        //     return bar(0, foo(0)) + bar(1, 2)
        //   }
        //
        // This should compile to:
        //
        //   def test int {
        //     return bar(0, foo(0)) + 2
        //   }
        //
        if (!(info.unusedArguments.length === 0)) {
          var hasSideEffects = false;

          for (var i2 = 0, list1 = info.unusedArguments, count1 = list1.length; i2 < count1; ++i2) {
            var index = list1[i2];

            if (!node.children[index + 1 | 0].hasNoSideEffects()) {
              hasSideEffects = true;
              break;
            }
          }

          if (hasSideEffects) {
            continue;
          }
        }

        var clone = info.inlineValue.clone().withType(node.resolvedType);
        var values = node.removeChildren();
        var value = values.shift();
        assert(value.kind === Skew.NodeKind.NAME && value.symbol === info.symbol);
        node.become(clone);
        Skew.Inlining.recursivelySubstituteArguments(node, info.symbol.$arguments, values);

        // Remove the inlined result entirely if appropriate
        var parent = node.parent;

        if (parent !== null && parent.kind === Skew.NodeKind.EXPRESSION && node.hasNoSideEffects()) {
          parent.remove();
        }
      }
    }
  };

  Skew.Inlining.recursivelySubstituteArguments = function(node, $arguments, values) {
    // Substitute the argument if this is an argument name
    var symbol = node.symbol;

    if (symbol !== null && Skew.SymbolKind.isVariable(symbol.kind)) {
      var index = $arguments.indexOf(symbol.asVariableSymbol());

      if (index !== -1) {
        node.replaceWith(values[index]);
        return;
      }
    }

    // Otherwise, recursively search for substitutions in all child nodes
    var children = node.children;

    if (children !== null) {
      for (var i = 0, list = children, count = list.length; i < count; ++i) {
        var child = list[i];

        if (child !== null) {
          Skew.Inlining.recursivelySubstituteArguments(child, $arguments, values);
        }
      }
    }
  };

  Skew.Inlining.InliningInfo = function(symbol, inlineValue, callSites, unusedArguments) {
    var self = this;
    self.symbol = symbol;
    self.inlineValue = inlineValue;
    self.callSites = callSites;
    self.unusedArguments = unusedArguments;
    self.shouldInline = true;
    self.bodyCalls = [];
  };

  // Each node in the inlining graph is a symbol of an inlineable function and
  // each directional edge is from a first function to a second function that is
  // called directly within the body of the first function. Indirect function
  // calls that may become direct calls through inlining can be discovered by
  // traversing edges of this graph.
  Skew.Inlining.InliningGraph = function(graph) {
    var self = this;
    self.inliningInfo = [];
    self.symbolToInfoIndex = Object.create(null);

    // Create the nodes in the graph
    for (var i = 0, list = graph.callInfo, count = list.length; i < count; ++i) {
      var callInfo = list[i];
      var info = Skew.Inlining.InliningGraph.createInliningInfo(callInfo);

      if (info !== null) {
        self.symbolToInfoIndex[info.symbol.id] = self.inliningInfo.length;
        self.inliningInfo.push(info);
      }
    }

    // Create the edges in the graph
    for (var i2 = 0, list2 = self.inliningInfo, count2 = list2.length; i2 < count2; ++i2) {
      var info1 = list2[i2];

      for (var i1 = 0, list1 = graph.callInfo[graph.symbolToInfoIndex[info1.symbol.id]].callSites, count1 = list1.length; i1 < count1; ++i1) {
        var callSite = list1[i1];
        var $function = callSite.enclosingFunction;

        if ($function !== null && $function.kind === Skew.SymbolKind.FUNCTION_GLOBAL) {
          var index = in_IntMap.get(self.symbolToInfoIndex, $function.id, -1);

          if (index !== -1) {
            self.inliningInfo[index].bodyCalls.push(info1);
          }
        }
      }
    }

    // Detect and disable infinitely expanding inline operations
    for (var i3 = 0, list3 = self.inliningInfo, count3 = list3.length; i3 < count3; ++i3) {
      var info2 = list3[i3];
      info2.shouldInline = !Skew.Inlining.InliningGraph.containsInfiniteExpansion(info2, []);
    }
  };

  Skew.Inlining.InliningGraph.containsInfiniteExpansion = function(info, symbols) {
    // This shouldn't get very long in normal programs so O(n) here is fine
    if (symbols.indexOf(info.symbol) !== -1) {
      return true;
    }

    // Do a depth-first search on the graph and check for cycles
    symbols.push(info.symbol);

    for (var i = 0, list = info.bodyCalls, count = list.length; i < count; ++i) {
      var bodyCall = list[i];

      if (Skew.Inlining.InliningGraph.containsInfiniteExpansion(bodyCall, symbols)) {
        return true;
      }
    }

    symbols.pop();
    return false;
  };

  Skew.Inlining.InliningGraph.createInliningInfo = function(info) {
    var symbol = info.symbol;

    // Inline functions consisting of a single return statement
    if (symbol.kind === Skew.SymbolKind.FUNCTION_GLOBAL) {
      var block = symbol.block;

      if (block === null) {
        return null;
      }

      // Replace functions with empty bodies with null
      if (!block.hasChildren()) {
        var unusedArguments = [];

        for (var i = 0, count1 = symbol.$arguments.length; i < count1; ++i) {
          unusedArguments.push(i);
        }

        return new Skew.Inlining.InliningInfo(symbol, new Skew.Node(Skew.NodeKind.NULL), info.callSites, unusedArguments);
      }

      var first = block.children[0];
      var inlineValue = null;

      // If the first value in the function is a return statement, then the
      // function body doesn't need to only have one statement. Subsequent
      // statements are just dead code and will never be executed anyway.
      if (first.kind === Skew.NodeKind.RETURN) {
        inlineValue = first.returnValue();
      }

      // Otherwise, this statement must be a lone expression statement
      else if (first.kind === Skew.NodeKind.EXPRESSION && block.children.length === 1) {
        inlineValue = first.expressionValue();
      }

      if (inlineValue !== null) {
        // Count the number of times each symbol is observed. Argument
        // variables that are used more than once may need a let statement
        // to avoid changing the semantics of the call site. For now, just
        // only inline functions where each argument is used exactly once.
        var argumentCounts = Object.create(null);

        for (var i1 = 0, list = symbol.$arguments, count2 = list.length; i1 < count2; ++i1) {
          var argument = list[i1];
          argumentCounts[argument.id] = 0;
        }

        if (Skew.Inlining.InliningGraph.recursivelyCountArgumentUses(inlineValue, argumentCounts)) {
          var unusedArguments1 = [];
          var isSimpleSubstitution = true;

          for (var i2 = 0, count3 = symbol.$arguments.length; i2 < count3; ++i2) {
            var count = argumentCounts[symbol.$arguments[i2].id];

            if (count === 0) {
              unusedArguments1.push(i2);
            }

            else if (count !== 1) {
              isSimpleSubstitution = false;
              break;
            }
          }

          if (isSimpleSubstitution) {
            return new Skew.Inlining.InliningInfo(symbol, inlineValue, info.callSites, unusedArguments1);
          }
        }
      }
    }

    return null;
  };

  // This returns false if inlining is impossible
  Skew.Inlining.InliningGraph.recursivelyCountArgumentUses = function(node, argumentCounts) {
    // Prevent inlining of lambda expressions. They have their own function
    // symbols that reference the original block and won't work with cloning.
    // Plus inlining lambdas leads to code bloat.
    if (node.kind === Skew.NodeKind.LAMBDA) {
      return false;
    }

    // Inlining is impossible at this node if it's impossible for any child node
    var children = node.children;

    if (children !== null) {
      for (var i = 0, list = children, count1 = list.length; i < count1; ++i) {
        var child = list[i];

        if (child !== null && !Skew.Inlining.InliningGraph.recursivelyCountArgumentUses(child, argumentCounts)) {
          return false;
        }
      }
    }

    var symbol = node.symbol;

    if (symbol !== null) {
      var count = in_IntMap.get(argumentCounts, symbol.id, -1);

      if (count !== -1) {
        argumentCounts[symbol.id] = count + 1 | 0;

        // Prevent inlining of functions that modify their arguments locally. For
        // example, inlining this would lead to incorrect code:
        //
        //   def foo(x int, y int) {
        //     x += y
        //   }
        //
        //   def test {
        //     foo(1, 2)
        //   }
        //
        if (node.isAssignTarget()) {
          return false;
        }
      }
    }

    return true;
  };

  Skew.Merging = {};

  Skew.Merging.mergeObject = function(log, parent, target, symbol) {
    target.scope = new Skew.ObjectScope(parent !== null ? parent.scope : null, target);
    symbol.scope = target.scope;
    symbol.parent = parent;

    if (symbol.parameters !== null) {
      for (var i = 0, list = symbol.parameters, count = list.length; i < count; ++i) {
        var parameter = list[i];
        parameter.scope = parent.scope;
        parameter.parent = target;

        // Type parameters cannot merge with any members
        var other = in_StringMap.get(target.members, parameter.name, null);

        if (other !== null) {
          log.semanticErrorDuplicateSymbol(parameter.range, parameter.name, other.range);
          continue;
        }

        target.members[parameter.name] = parameter;
      }
    }

    Skew.Merging.mergeObjects(log, target, symbol.objects);
    Skew.Merging.mergeFunctions(log, target, symbol.functions);
    Skew.Merging.mergeVariables(log, target, symbol.variables);
  };

  Skew.Merging.mergeObjects = function(log, parent, children) {
    var members = parent.members;
    in_List.removeIf(children, function(child) {
      var other = in_StringMap.get(members, child.name, null);

      // Simple case: no merging
      if (other === null) {
        members[child.name] = child;
        Skew.Merging.mergeObject(log, parent, child, child);
        return false;
      }

      // Can only merge with another of the same kind or with a namespace
      if (other.kind === Skew.SymbolKind.OBJECT_NAMESPACE) {
        other.kind = child.kind;
      }

      else if (child.kind !== Skew.SymbolKind.OBJECT_NAMESPACE && child.kind !== other.kind) {
        log.semanticErrorDuplicateSymbol(child.range, child.name, other.range);
        return true;
      }

      // Classes can only have one base type
      var object = other.asObjectSymbol();

      if (child.base !== null && object.base !== null) {
        log.semanticErrorDuplicateBaseType(child.base.range, child.name, object.base.range);
        return true;
      }

      if (child.base !== null) {
        object.base = child.base;
      }

      // Cannot merge two objects that both have type parameters
      if (child.parameters !== null && object.parameters !== null) {
        log.semanticErrorDuplicateTypeParameters(Skew.Merging.rangeOfParameters(child.parameters), child.name, Skew.Merging.rangeOfParameters(object.parameters));
        return true;
      }

      // Merge "child" into "other"
      Skew.Merging.mergeObject(log, parent, object, child);
      object.mergeAnnotationsAndCommentsFrom(child);
      in_List.append2(object.objects, child.objects);
      in_List.append2(object.functions, child.functions);
      in_List.append2(object.variables, child.variables);

      if (child.parameters !== null) {
        object.parameters = child.parameters;
      }

      for (var i = 0, list = child.guards, count = list.length; i < count; ++i) {
        var guard = list[i];
        guard.parent = object;
        object.guards.push(guard);
      }

      return true;
    });
  };

  Skew.Merging.mergeFunctions = function(log, parent, children) {
    var members = parent.members;

    for (var i1 = 0, list1 = children, count1 = list1.length; i1 < count1; ++i1) {
      var child = list1[i1];
      var other = in_StringMap.get(members, child.name, null);
      var scope = new Skew.FunctionScope(parent.scope, child);
      child.scope = scope;
      child.parent = parent;

      if (child.parameters !== null) {
        for (var i = 0, list = child.parameters, count = list.length; i < count; ++i) {
          var parameter = list[i];
          parameter.scope = scope;
          parameter.parent = child;

          // Type parameters cannot merge with other parameters on this function
          var previous = in_StringMap.get(scope.parameters, parameter.name, null);

          if (previous !== null) {
            log.semanticErrorDuplicateSymbol(parameter.range, parameter.name, previous.range);
            continue;
          }

          scope.parameters[parameter.name] = parameter;
        }
      }

      // Simple case: no merging
      if (other === null) {
        members[child.name] = child;
        continue;
      }

      var childKind = Skew.Merging.overloadedKind(child.kind);
      var otherKind = Skew.Merging.overloadedKind(other.kind);

      // Merge with another symbol of the same overloaded group type
      if (childKind !== otherKind || !Skew.SymbolKind.isOverloadedFunction(childKind)) {
        log.semanticErrorDuplicateSymbol(child.range, child.name, other.range);
        continue;
      }

      // Merge with a group of overloaded functions
      if (Skew.SymbolKind.isOverloadedFunction(other.kind)) {
        other.asOverloadedFunctionSymbol().symbols.push(child);
        child.overloaded = other.asOverloadedFunctionSymbol();
        continue;
      }

      // Create an overload group
      var overloaded = new Skew.OverloadedFunctionSymbol(childKind, child.name, [other.asFunctionSymbol(), child]);
      members[child.name] = overloaded;
      other.asFunctionSymbol().overloaded = overloaded;
      child.overloaded = overloaded;
      overloaded.scope = parent.scope;
      overloaded.parent = parent;
    }
  };

  Skew.Merging.overloadedKind = function(kind) {
    return kind === Skew.SymbolKind.FUNCTION_CONSTRUCTOR || kind === Skew.SymbolKind.FUNCTION_GLOBAL ? Skew.SymbolKind.OVERLOADED_GLOBAL : kind === Skew.SymbolKind.FUNCTION_ANNOTATION ? Skew.SymbolKind.OVERLOADED_ANNOTATION : kind === Skew.SymbolKind.FUNCTION_INSTANCE ? Skew.SymbolKind.OVERLOADED_INSTANCE : kind;
  };

  Skew.Merging.mergeVariables = function(log, parent, children) {
    var members = parent.members;

    for (var i = 0, list = children, count = list.length; i < count; ++i) {
      var child = list[i];
      var other = in_StringMap.get(members, child.name, null);
      child.scope = new Skew.VariableScope(parent.scope, child);
      child.parent = parent;

      // Variables never merge
      if (other !== null) {
        log.semanticErrorDuplicateSymbol(child.range, child.name, other.range);
        continue;
      }

      members[child.name] = child;
    }
  };

  Skew.Merging.rangeOfParameters = function(parameters) {
    return Skew.Range.span(parameters[0].range, in_List.last(parameters).range);
  };

  Skew.Renaming = {};

  Skew.Renaming.renameObject = function(symbol) {
    for (var i = 0, list = symbol.objects, count1 = list.length; i < count1; ++i) {
      var object = list[i];
      Skew.Renaming.renameObject(object);
    }

    for (var i1 = 0, list1 = symbol.functions, count2 = list1.length; i1 < count2; ++i1) {
      var $function = list1[i1];

      if (!$function.isImportedOrExported() && $function.overridden === null) {
        var scope = $function.scope.parent;
        var count = $function.$arguments.length;

        if ((count === 0 || count === 1 && $function.kind === Skew.SymbolKind.FUNCTION_GLOBAL) && $function.name in Skew.Renaming.unaryPrefixes) {
          $function.name = scope.generateName(Skew.Renaming.unaryPrefixes[$function.name]);
        }

        else if ($function.name in Skew.Renaming.prefixes) {
          $function.name = scope.generateName(Skew.Renaming.prefixes[$function.name]);
        }

        else if ($function.name !== "" && $function.name.charCodeAt(0) === 64) {
          $function.name = scope.generateName($function.name.slice(1));
        }

        else if (Skew.Renaming.isInvalidIdentifier($function.name)) {
          $function.name = scope.generateName("_");
        }

        else if ($function.overloaded !== null && $function.overloaded.symbols.length > 1) {
          $function.name = scope.generateName($function.name);
        }
      }
    }
  };

  Skew.Renaming.useOverriddenNames = function(symbol) {
    for (var i = 0, list = symbol.objects, count = list.length; i < count; ++i) {
      var object = list[i];
      Skew.Renaming.useOverriddenNames(object);
    }

    for (var i1 = 0, list1 = symbol.functions, count1 = list1.length; i1 < count1; ++i1) {
      var $function = list1[i1];

      if ($function.overridden !== null) {
        var overridden = $function.overridden;

        while (overridden.overridden !== null) {
          overridden = overridden.overridden;
        }

        $function.name = overridden.name;
      }
    }
  };

  Skew.Renaming.isAlpha = function(c) {
    return c >= 97 && c <= 122 || c >= 65 && c <= 90 || c === 95;
  };

  Skew.Renaming.isNumber = function(c) {
    return c >= 48 && c <= 57;
  };

  Skew.Renaming.isInvalidIdentifier = function(name) {
    for (var i = 0, count = name.length; i < count; ++i) {
      var c = name.charCodeAt(i);

      if (!Skew.Renaming.isAlpha(c) && (i === 0 || !Skew.Renaming.isNumber(c))) {
        return true;
      }
    }

    return false;
  };

  Skew.Resolving = {};

  Skew.Resolving.ConversionKind = {
    IMPLICIT: 0,
    EXPLICIT: 1
  };

  Skew.Resolving.SymbolStatistic = {
    READ: 0,
    WRITE: 1
  };

  Skew.Resolving.LocalVariableStatistics = function(symbol) {
    var self = this;
    self.symbol = symbol;
    self.readCount = 0;
    self.writeCount = 0;
  };

  Skew.Resolving.Resolver = function(global, options, defines, cache, log) {
    var self = this;
    self.global = global;
    self.options = options;
    self.defines = defines;
    self.cache = cache;
    self.log = log;
    self.foreachLoops = [];
    self.localVariableStatistics = Object.create(null);
    self.constantFolder = null;
    self.isMergingGuards = true;
  };

  Skew.Resolving.Resolver.prototype.initializeSymbol = function(symbol) {
    var self = this;

    // The scope should have been set by the merging pass (or by this pass for local variables)
    assert(symbol.scope !== null);

    // Only initialize the symbol once
    if (symbol.state === Skew.SymbolState.UNINITIALIZED) {
      symbol.state = Skew.SymbolState.INITIALIZING;

      switch (symbol.kind) {
        case Skew.SymbolKind.OBJECT_CLASS:
        case Skew.SymbolKind.OBJECT_ENUM:
        case Skew.SymbolKind.OBJECT_GLOBAL:
        case Skew.SymbolKind.OBJECT_INTERFACE:
        case Skew.SymbolKind.OBJECT_NAMESPACE: {
          self.initializeObject(symbol.asObjectSymbol());
          break;
        }

        case Skew.SymbolKind.FUNCTION_ANNOTATION:
        case Skew.SymbolKind.FUNCTION_CONSTRUCTOR:
        case Skew.SymbolKind.FUNCTION_GLOBAL:
        case Skew.SymbolKind.FUNCTION_INSTANCE:
        case Skew.SymbolKind.FUNCTION_LOCAL: {
          self.initializeFunction(symbol.asFunctionSymbol());
          break;
        }

        case Skew.SymbolKind.VARIABLE_ENUM:
        case Skew.SymbolKind.VARIABLE_GLOBAL:
        case Skew.SymbolKind.VARIABLE_INSTANCE:
        case Skew.SymbolKind.VARIABLE_LOCAL: {
          self.initializeVariable(symbol.asVariableSymbol());
          break;
        }

        case Skew.SymbolKind.PARAMETER_FUNCTION:
        case Skew.SymbolKind.PARAMETER_OBJECT: {
          self.initializeParameter(symbol.asParameterSymbol());
          break;
        }

        case Skew.SymbolKind.OVERLOADED_ANNOTATION:
        case Skew.SymbolKind.OVERLOADED_GLOBAL:
        case Skew.SymbolKind.OVERLOADED_INSTANCE: {
          self.initializeOverloadedFunction(symbol.asOverloadedFunctionSymbol());
          break;
        }

        default: {
          assert(false);
          break;
        }
      }

      assert(symbol.resolvedType !== null);
      symbol.state = Skew.SymbolState.INITIALIZED;

      if (Skew.SymbolKind.isFunction(symbol.kind)) {
        var $function = symbol.asFunctionSymbol();
        var overloaded = $function.overloaded;

        // After initializing a function symbol, ensure the entire overload set is initialized
        if (overloaded !== null && overloaded.state === Skew.SymbolState.UNINITIALIZED) {
          self.initializeSymbol(overloaded);
        }

        if (symbol.isEntryPoint()) {
          self.validateEntryPoint($function);
        }
      }
    }

    // Detect cyclic symbol references such as "foo foo;"
    else if (symbol.state === Skew.SymbolState.INITIALIZING) {
      self.log.semanticErrorCyclicDeclaration(symbol.range, symbol.name);
      symbol.resolvedType = Skew.Type.DYNAMIC;
    }
  };

  Skew.Resolving.Resolver.prototype.validateEntryPoint = function(symbol) {
    var self = this;

    // Detect duplicate entry points
    if (self.cache.entryPointSymbol !== null) {
      self.log.semanticErrorDuplicateEntryPoint(symbol.range, self.cache.entryPointSymbol.range);
      return;
    }

    self.cache.entryPointSymbol = symbol;

    // Only recognize a few entry point types
    var type = symbol.resolvedType;

    if (type !== Skew.Type.DYNAMIC) {
      var argumentTypes = type.argumentTypes;

      // The argument list must be empty or one argument of type "List<string>"
      if (argumentTypes.length > 1 || argumentTypes.length === 1 && argumentTypes[0] !== self.cache.createListType(self.cache.stringType)) {
        self.log.semanticErrorInvalidEntryPointArguments(Skew.Range.span(symbol.$arguments[0].range, in_List.last(symbol.$arguments).type.range), symbol.name);
      }

      // The return type must be nothing or "int"
      else if (type.returnType !== null && type.returnType !== self.cache.intType) {
        self.log.semanticErrorInvalidEntryPointReturnType(symbol.returnType.range, symbol.name);
      }
    }
  };

  Skew.Resolving.Resolver.prototype.resolveDefines = function(symbol) {
    var self = this;
    var key = symbol.fullName();
    var define = in_StringMap.get(self.defines, key, null);

    if (define === null) {
      return;
    }

    // Remove the define so we can tell what defines weren't used later on
    delete(self.defines[key]);
    var type = symbol.resolvedType;
    var range = define.value;
    var value = range.toString();
    var node = null;

    // Special-case booleans
    if (type === self.cache.boolType) {
      if (value === "true" || value === "false") {
        node = new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.BoolContent(value === "true"));
      }
    }

    // Special-case doubles
    else if (type === self.cache.doubleType) {
      var number = +value;

      if (!isNaN(number)) {
        node = new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.DoubleContent(number));
      }
    }

    // Special-case strings
    else if (type === self.cache.stringType) {
      node = new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.StringContent(value));
    }

    // Special-case enums
    else if (type.isEnum()) {
      node = new Skew.Node(Skew.NodeKind.DOT).withContent(new Skew.StringContent(value)).withChildren([null]);
    }

    // Integers can also apply to doubles
    if (node === null && self.cache.isNumeric(type)) {
      var box = Skew.Parsing.parseIntLiteral(value);

      if (box !== null) {
        node = new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.IntContent(box.value));
      }
    }

    // Stop if anything failed above
    if (node === null) {
      self.log.semanticErrorInvalidDefine1(range, value, type, key);
      return;
    }

    self.resolveAsParameterizedExpressionWithConversion(node.withRange(range), self.global.scope, type);
    symbol.value = node;
  };

  Skew.Resolving.Resolver.prototype.resolveAnnotations = function(symbol) {
    var self = this;
    var parent = symbol.parent;
    var annotations = symbol.annotations;

    // The import/export annotations are inherited, except import isn't inherited for implemented functions
    if (parent !== null && (Skew.SymbolKind.isVariable(symbol.kind) || Skew.SymbolKind.isFunction(symbol.kind))) {
      symbol.flags |= parent.flags & (Skew.SymbolKind.isFunction(symbol.kind) && symbol.asFunctionSymbol().block !== null ? Skew.Symbol.IS_EXPORTED : Skew.Symbol.IS_IMPORTED | Skew.Symbol.IS_EXPORTED);
    }

    // Resolve annotations on this symbol after annotation inheritance
    if (annotations !== null) {
      for (var i = 0, list = annotations, count = list.length; i < count; ++i) {
        var annotation = list[i];
        self.resolveAnnotation(annotation, symbol);
      }
    }
  };

  Skew.Resolving.Resolver.prototype.resolveParameters = function(parameters) {
    var self = this;

    if (parameters !== null) {
      for (var i = 0, list = parameters, count = list.length; i < count; ++i) {
        var parameter = list[i];
        self.resolveParameter(parameter);
      }
    }
  };

  Skew.Resolving.Resolver.prototype.initializeParameter = function(symbol) {
    var self = this;

    if (symbol.resolvedType === null) {
      symbol.resolvedType = new Skew.Type(Skew.TypeKind.SYMBOL, symbol);
    }

    self.resolveAnnotations(symbol);
  };

  Skew.Resolving.Resolver.prototype.resolveParameter = function(symbol) {
    var self = this;
    self.initializeSymbol(symbol);
  };

  Skew.Resolving.Resolver.prototype.initializeObject = function(symbol) {
    var self = this;

    if (symbol.resolvedType === null) {
      symbol.resolvedType = new Skew.Type(Skew.TypeKind.SYMBOL, symbol);
    }

    self.resolveParameters(symbol.parameters);
    self.forbidOverriddenSymbol(symbol);

    // Resolve the base type (only for classes)
    if (symbol.base !== null) {
      self.resolveAsParameterizedType(symbol.base, symbol.scope);
      var baseType = symbol.base.resolvedType;

      if (baseType.kind === Skew.TypeKind.SYMBOL && baseType.symbol.kind === Skew.SymbolKind.OBJECT_CLASS && !baseType.symbol.isValueType()) {
        symbol.baseClass = baseType.symbol.asObjectSymbol();

        // Don't lose the type parameters from the base type
        symbol.resolvedType.environment = baseType.environment;
      }

      else if (baseType !== Skew.Type.DYNAMIC) {
        self.log.semanticErrorInvalidBaseType(symbol.base.range, baseType);
      }
    }

    // Assign values for all enums before they are initialized
    if (symbol.kind === Skew.SymbolKind.OBJECT_ENUM) {
      var nextEnumValue = 0;

      for (var i = 0, list = symbol.variables, count = list.length; i < count; ++i) {
        var variable = list[i];

        if (variable.kind === Skew.SymbolKind.VARIABLE_ENUM) {
          variable.value = new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.IntContent(nextEnumValue)).withType(symbol.resolvedType).withRange(variable.range);
          ++nextEnumValue;
        }
      }
    }

    self.resolveAnnotations(symbol);

    // Create a default constructor if one doesn't exist
    var $constructor = in_StringMap.get(symbol.members, "new", null);

    if (symbol.kind === Skew.SymbolKind.OBJECT_CLASS && !symbol.isImported() && $constructor === null) {
      var baseConstructor = symbol.baseClass !== null ? in_StringMap.get(symbol.baseClass.members, "new", null) : null;

      // Unwrap the overload group if present
      if (baseConstructor !== null && baseConstructor.kind === Skew.SymbolKind.OVERLOADED_GLOBAL) {
        var overloaded = baseConstructor.asOverloadedFunctionSymbol();

        for (var i1 = 0, list1 = overloaded.symbols, count1 = list1.length; i1 < count1; ++i1) {
          var overload = list1[i1];

          if (overload.kind === Skew.SymbolKind.FUNCTION_CONSTRUCTOR) {
            if (baseConstructor.kind === Skew.SymbolKind.FUNCTION_CONSTRUCTOR) {
              // Signal that there isn't a single base constructor
              baseConstructor = null;
              break;
            }

            baseConstructor = overload;
          }
        }
      }

      // A default constructor can only be created if the base class has a single constructor
      if (symbol.baseClass === null || baseConstructor !== null && baseConstructor.kind === Skew.SymbolKind.FUNCTION_CONSTRUCTOR) {
        var generated = new Skew.FunctionSymbol(Skew.SymbolKind.FUNCTION_CONSTRUCTOR, "new");
        generated.scope = new Skew.FunctionScope(symbol.scope, generated);
        generated.flags |= Skew.Symbol.IS_AUTOMATICALLY_GENERATED;
        generated.parent = symbol;
        generated.range = symbol.range;
        generated.overridden = baseConstructor !== null ? baseConstructor.asFunctionSymbol() : null;
        symbol.functions.push(generated);
        symbol.members[generated.name] = generated;
      }
    }

    // Create a default toString if one doesn't exist
    if (symbol.kind === Skew.SymbolKind.OBJECT_ENUM && !symbol.isImported() && !("toString" in symbol.members)) {
      var generated1 = new Skew.FunctionSymbol(Skew.SymbolKind.FUNCTION_INSTANCE, "toString");
      generated1.scope = new Skew.FunctionScope(symbol.scope, generated1);
      generated1.flags |= Skew.Symbol.IS_AUTOMATICALLY_GENERATED;
      generated1.parent = symbol;
      generated1.range = symbol.range;
      symbol.functions.push(generated1);
      symbol.members[generated1.name] = generated1;
    }
  };

  Skew.Resolving.Resolver.prototype.initializeGlobals = function() {
    var self = this;
    self.initializeSymbol(self.cache.boolType.symbol);
    self.initializeSymbol(self.cache.doubleType.symbol);
    self.initializeSymbol(self.cache.intMapType.symbol);
    self.initializeSymbol(self.cache.intType.symbol);
    self.initializeSymbol(self.cache.listType.symbol);
    self.initializeSymbol(self.cache.stringMapType.symbol);
    self.initializeSymbol(self.cache.stringType.symbol);
  };

  Skew.Resolving.Resolver.prototype.resolveGlobal = function() {
    var self = this;
    self.resolveObject(self.global);
    self.convertForeachLoops();
    self.scanLocalVariables();
    self.discardUnusedDefines();
  };

  Skew.Resolving.Resolver.prototype.removeObsoleteFunctions = function(symbol) {
    var self = this;

    for (var i = 0, list = symbol.objects, count = list.length; i < count; ++i) {
      var object = list[i];
      self.removeObsoleteFunctions(object);
    }

    in_List.removeIf(symbol.functions, function($function) {
      return $function.isObsolete();
    });
  };

  Skew.Resolving.Resolver.prototype.reportGuardMergingFailure = function(node) {
    var self = this;

    if (self.isMergingGuards) {
      while (node !== null) {
        node.resolvedType = null;
        node = node.parent;
      }

      throw null;
    }
  };

  Skew.Resolving.Resolver.prototype.iterativelyMergeGuards = function() {
    var self = this;

    // Iterate until a fixed point is reached
    var guards = [];
    self.scanForGuards(self.global, guards);

    while (!(guards.length === 0)) {
      var count = guards.length;
      self.processGuards(guards);
      guards = [];
      self.scanForGuards(self.global, guards);

      // Each iteration must remove at least one guard to continue
      if (guards.length === count) {
        break;
      }
    }

    self.isMergingGuards = false;

    // All remaining guards are errors
    for (var i = 0, list = guards, count1 = list.length; i < count1; ++i) {
      var guard = list[i];
      var count2 = self.log.errorCount;
      self.resolveAsParameterizedExpressionWithConversion(guard.test, guard.parent.scope, self.cache.boolType);

      if (self.log.errorCount === count2) {
        self.log.semanticErrorExpectedConstant(guard.test.range);
      }
    }
  };

  Skew.Resolving.Resolver.prototype.scanForGuards = function(symbol, guards) {
    var self = this;
    in_List.append2(guards, symbol.guards);

    for (var i = 0, list = symbol.objects, count = list.length; i < count; ++i) {
      var object = list[i];
      self.scanForGuards(object, guards);
    }
  };

  Skew.Resolving.Resolver.prototype.attemptToResolveGuardConstant = function(node, scope) {
    var self = this;
    assert(scope !== null);

    try {
      self.resolveAsParameterizedExpressionWithConversion(node, scope, self.cache.boolType);
      self.constantFolder.foldConstants(node);
      return true;
    }

    catch ($e) {
    }

    return false;
  };

  Skew.Resolving.Resolver.prototype.processGuards = function(guards) {
    var self = this;

    for (var i = 0, list = guards, count = list.length; i < count; ++i) {
      var guard = list[i];
      var test = guard.test;
      var parent = guard.parent;

      // If it's not a constant, we'll just try again in the next iteration
      if (!self.attemptToResolveGuardConstant(test, parent.scope)) {
        continue;
      }

      if (test.isBool()) {
        in_List.removeOne(parent.guards, guard);

        // False values mean this subtree gets culled
        if (test.isTrue()) {
          var symbol = guard.contents;
          Skew.Merging.mergeObjects(self.log, parent, symbol.objects);
          Skew.Merging.mergeFunctions(self.log, parent, symbol.functions);
          Skew.Merging.mergeVariables(self.log, parent, symbol.variables);
          in_List.append2(parent.objects, symbol.objects);
          in_List.append2(parent.functions, symbol.functions);
          in_List.append2(parent.variables, symbol.variables);
        }
      }
    }
  };

  // Foreach loops are converted to for loops after everything is resolved
  // because that process needs to generate symbol names and it's much easier
  // to generate non-conflicting symbol names after all local variables have
  // been defined.
  Skew.Resolving.Resolver.prototype.convertForeachLoops = function() {
    var self = this;

    for (var i = 0, list1 = self.foreachLoops, count1 = list1.length; i < count1; ++i) {
      var node = list1[i];
      var symbol = node.symbol.asVariableSymbol();

      // Generate names at the function level to avoid conflicts with local scopes
      var scope = symbol.scope.findEnclosingFunctionOrLambda();
      var value = node.foreachValue();
      var block = node.foreachBlock();

      // Handle "for i in 0..10"
      if (value.kind === Skew.NodeKind.PAIR) {
        var first = value.firstValue().replaceWithNull();
        var second = value.secondValue().replaceWithNull();
        var setup = [Skew.Node.createVar(symbol)];
        var symbolName = new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent(symbol.name)).withSymbol(symbol).withType(self.cache.intType);
        var update = Skew.Node.createUnary(Skew.NodeKind.INCREMENT, symbolName);
        var test;

        // Special-case constant iteration limits to generate simpler code
        if (second.kind === Skew.NodeKind.CONSTANT || second.kind === Skew.NodeKind.NAME && second.symbol !== null && second.symbol.isConst()) {
          test = Skew.Node.createBinary(Skew.NodeKind.LESS_THAN, symbolName.clone(), second);
        }

        // Otherwise, save the iteration limit in case it changes during iteration
        else {
          var count = new Skew.VariableSymbol(Skew.SymbolKind.VARIABLE_LOCAL, scope.generateName("count"));
          count.resolvedType = self.cache.intType;
          count.value = second;
          count.state = Skew.SymbolState.INITIALIZED;
          setup.push(Skew.Node.createVar(count));
          test = Skew.Node.createBinary(Skew.NodeKind.LESS_THAN, symbolName.clone(), new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent(count.name)).withSymbol(count).withType(self.cache.intType));
        }

        // Use a C-style for loop to implement this foreach loop
        symbol.flags &= ~Skew.Symbol.IS_CONST;
        symbol.value = first;
        node.become(Skew.Node.createFor(setup, test, update, block.replaceWithNull()).withComments(node.comments));

        // Make sure the new expressions are resolved
        self.resolveNode(test, symbol.scope, null);
        self.resolveNode(update, symbol.scope, null);
      }

      else if (self.cache.isList(value.resolvedType)) {
        // Create the index variable
        var index = new Skew.VariableSymbol(Skew.SymbolKind.VARIABLE_LOCAL, scope.generateName("i"));
        index.resolvedType = self.cache.intType;
        index.value = new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.IntContent(0)).withType(self.cache.intType);
        index.state = Skew.SymbolState.INITIALIZED;
        var indexName = new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent(index.name)).withSymbol(index).withType(index.resolvedType);

        // Create the list variable
        var list = new Skew.VariableSymbol(Skew.SymbolKind.VARIABLE_LOCAL, scope.generateName("list"));
        list.resolvedType = value.resolvedType;
        list.value = value.replaceWithNull();
        list.state = Skew.SymbolState.INITIALIZED;
        var listName = new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent(list.name)).withSymbol(list).withType(list.resolvedType);

        // Create the count variable
        var count2 = new Skew.VariableSymbol(Skew.SymbolKind.VARIABLE_LOCAL, scope.generateName("count"));
        count2.resolvedType = self.cache.intType;
        count2.value = new Skew.Node(Skew.NodeKind.DOT).withContent(new Skew.StringContent("count")).withChildren([listName]);
        count2.state = Skew.SymbolState.INITIALIZED;
        var countName = new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent(count2.name)).withSymbol(count2).withType(count2.resolvedType);

        // Move the loop variable into the loop body
        symbol.value = Skew.Node.createIndex(listName.clone(), [indexName]);
        block.insertChild(0, Skew.Node.createVar(symbol));

        // Use a C-style for loop to implement this foreach loop
        var setup1 = [Skew.Node.createVar(index), Skew.Node.createVar(list), Skew.Node.createVar(count2)];
        var test1 = Skew.Node.createBinary(Skew.NodeKind.LESS_THAN, indexName.clone(), countName);
        var update1 = Skew.Node.createUnary(Skew.NodeKind.INCREMENT, indexName.clone());
        node.become(Skew.Node.createFor(setup1, test1, update1, block.replaceWithNull()).withComments(node.comments));

        // Make sure the new expressions are resolved
        self.resolveNode(symbol.value, symbol.scope, null);
        self.resolveNode(count2.value, symbol.scope, null);
        self.resolveNode(test1, symbol.scope, null);
        self.resolveNode(update1, symbol.scope, null);
      }
    }
  };

  Skew.Resolving.Resolver.prototype.scanLocalVariables = function() {
    var self = this;

    for (var i = 0, list = in_IntMap.values(self.localVariableStatistics), count = list.length; i < count; ++i) {
      var info = list[i];
      var symbol = info.symbol;

      // Variables that are never re-assigned can safely be considered constants for constant folding
      if (symbol.value !== null && info.writeCount === 0) {
        symbol.flags |= Skew.Symbol.IS_CONST;
      }

      // Unused local variables can safely be removed, but don't warn about "for i in 0..10 {}"
      if (info.readCount === 0 && !symbol.isLoopVariable()) {
        self.log.semanticWarningUnreadLocalVariable(symbol.range, symbol.name);
      }

      // Rename local variables that conflict
      var scope = symbol.scope;

      while (scope.kind() === Skew.ScopeKind.LOCAL) {
        scope = scope.parent;
      }

      if (scope.used !== null && in_StringMap.get(scope.used, symbol.name, null) !== symbol) {
        symbol.name = scope.generateName(symbol.name);
      }
    }
  };

  Skew.Resolving.Resolver.prototype.discardUnusedDefines = function() {
    var self = this;

    for (var i = 0, list = Object.keys(self.defines), count = list.length; i < count; ++i) {
      var key = list[i];
      self.log.semanticErrorInvalidDefine2(self.defines[key].name, key);
    }
  };

  Skew.Resolving.Resolver.prototype.resolveObject = function(symbol) {
    var self = this;
    self.initializeSymbol(symbol);

    for (var i = 0, list = symbol.objects, count = list.length; i < count; ++i) {
      var object = list[i];
      self.resolveObject(object);
    }

    for (var i1 = 0, list1 = symbol.functions, count1 = list1.length; i1 < count1; ++i1) {
      var $function = list1[i1];
      self.resolveFunction($function);
    }

    for (var i2 = 0, list2 = symbol.variables, count2 = list2.length; i2 < count2; ++i2) {
      var variable = list2[i2];
      self.resolveVariable(variable);
    }
  };

  Skew.Resolving.Resolver.prototype.initializeFunction = function(symbol) {
    var self = this;

    if (symbol.resolvedType === null) {
      symbol.resolvedType = new Skew.Type(Skew.TypeKind.SYMBOL, symbol);
    }

    // Referencing a normal variable instead of a special node kind for "this"
    // makes many things much easier including lambda capture and devirtualization
    if (symbol.kind === Skew.SymbolKind.FUNCTION_INSTANCE || symbol.kind === Skew.SymbolKind.FUNCTION_CONSTRUCTOR) {
      symbol.self = new Skew.VariableSymbol(Skew.SymbolKind.VARIABLE_LOCAL, "self");
      symbol.self.flags |= Skew.Symbol.IS_CONST;
      symbol.self.resolvedType = self.cache.parameterize(symbol.parent.resolvedType);
      symbol.self.state = Skew.SymbolState.INITIALIZED;
    }

    // Lazily-initialize automatically generated functions
    if (symbol.isAutomaticallyGenerated()) {
      if (symbol.kind === Skew.SymbolKind.FUNCTION_CONSTRUCTOR) {
        assert(symbol.name === "new");
        self.automaticallyGenerateClassConstructor(symbol);
      }

      else if (symbol.kind === Skew.SymbolKind.FUNCTION_INSTANCE) {
        assert(symbol.name === "toString");
        self.automaticallyGenerateEnumToString(symbol);
      }
    }

    // Find the overridden function or overloaded function in the base class
    var overridden = self.findOverriddenMember(symbol);

    if (overridden !== null) {
      var symbolKind = Skew.Merging.overloadedKind(symbol.kind);
      var overriddenKind = Skew.Merging.overloadedKind(overridden.kind);

      // Make sure the overridden symbol can be merged with this symbol
      if (symbolKind !== overriddenKind) {
        self.log.semanticErrorBadOverride(symbol.range, symbol.name, symbol.parent.asObjectSymbol().base.resolvedType, overridden.range);
        overridden = null;
      }

      // Overriding something makes both symbols overloaded for simplicity
      else {
        Skew.Resolving.Resolver.ensureFunctionIsOverloaded(symbol);

        if (Skew.SymbolKind.isFunction(overridden.kind)) {
          var $function = overridden.asFunctionSymbol();
          Skew.Resolving.Resolver.ensureFunctionIsOverloaded($function);
          overridden = $function.overloaded;
        }
      }
    }

    self.resolveParameters(symbol.parameters);

    // Resolve the argument variables
    symbol.resolvedType.argumentTypes = [];

    for (var i = 0, list = symbol.$arguments, count1 = list.length; i < count1; ++i) {
      var argument = list[i];
      argument.scope = symbol.scope;
      self.resolveVariable(argument);
      symbol.resolvedType.argumentTypes.push(argument.resolvedType);
    }

    symbol.argumentOnlyType = self.cache.createLambdaType(symbol.resolvedType.argumentTypes, null);

    // Resolve the return type if present (no return type means "void")
    var returnType = null;

    if (symbol.returnType !== null) {
      if (symbol.kind === Skew.SymbolKind.FUNCTION_CONSTRUCTOR) {
        self.log.semanticErrorConstructorReturnType(symbol.returnType.range);
      }

      else {
        self.resolveAsParameterizedType(symbol.returnType, symbol.scope);
        returnType = symbol.returnType.resolvedType;
      }
    }

    // Constructors always return the type they construct
    if (symbol.kind === Skew.SymbolKind.FUNCTION_CONSTRUCTOR) {
      returnType = self.cache.parameterize(symbol.parent.resolvedType);
    }

    // The "<=>" operator must return a numeric value for comparison with zero
    var count = symbol.$arguments.length;

    if (symbol.name === "<=>") {
      if (returnType === null || !self.cache.isNumeric(returnType)) {
        self.log.semanticErrorComparisonOperatorNotNumeric(symbol.returnType !== null ? symbol.returnType.range : symbol.range);
        returnType = Skew.Type.DYNAMIC;
      }

      else if (count !== 1) {
        self.log.semanticErrorWrongArgumentCount(symbol.range, symbol.name, 1);
      }
    }

    // Setters must have one argument
    else if (symbol.isSetter() && count !== 1) {
      self.log.semanticErrorWrongArgumentCount(symbol.range, symbol.name, 1);
      symbol.flags &= ~Skew.Symbol.IS_SETTER;
    }

    // Validate argument count
    else {
      var argumentCount = Skew.argumentCountForOperator(symbol.name);
      var hasArgumentCountError = false;

      switch (argumentCount) {
        case Skew.ArgumentCount.ZERO:
        case Skew.ArgumentCount.ONE: {
          var expected = argumentCount === Skew.ArgumentCount.ZERO ? 0 : 1;

          if (count !== expected) {
            self.log.semanticErrorWrongArgumentCount(symbol.range, symbol.name, expected);
            hasArgumentCountError = true;
          }
          break;
        }

        case Skew.ArgumentCount.ZERO_OR_ONE:
        case Skew.ArgumentCount.ONE_OR_TWO:
        case Skew.ArgumentCount.TWO_OR_FEWER: {
          var lower = argumentCount === Skew.ArgumentCount.ONE_OR_TWO ? 1 : 0;
          var upper = argumentCount === Skew.ArgumentCount.ZERO_OR_ONE ? 1 : 2;

          if (count < lower || count > upper) {
            self.log.semanticErrorWrongArgumentCountRange(symbol.range, symbol.name, lower, upper);
            hasArgumentCountError = true;
          }
          break;
        }

        case Skew.ArgumentCount.ONE_OR_MORE:
        case Skew.ArgumentCount.TWO_OR_MORE: {
          var expected1 = argumentCount === Skew.ArgumentCount.ONE_OR_MORE ? 1 : 2;

          if (count < expected1) {
            self.log.semanticErrorWrongArgumentCountRange(symbol.range, symbol.name, expected1, -1);
            hasArgumentCountError = true;
          }
          break;
        }
      }

      // Enforce that the initializer constructor operators take lists of
      // values to avoid confusing error messages inside the code generated
      // for initializer expressions
      if (!hasArgumentCountError && (symbol.name === "{new}" || symbol.name === "[new]")) {
        for (var i1 = 0, list1 = symbol.$arguments, count2 = list1.length; i1 < count2; ++i1) {
          var argument1 = list1[i1];

          if (argument1.resolvedType !== Skew.Type.DYNAMIC && !self.cache.isList(argument1.resolvedType)) {
            self.log.semanticErrorExpectedList(argument1.range, argument1.name, argument1.resolvedType);
          }
        }
      }
    }

    // Link this symbol with the overridden symbol if there is one
    var hasOverrideError = false;

    if (overridden !== null) {
      var overloaded = overridden.asOverloadedFunctionSymbol();
      self.initializeSymbol(overloaded);

      for (var i2 = 0, list2 = overloaded.symbols, count3 = list2.length; i2 < count3; ++i2) {
        var overload = list2[i2];

        if (overload.argumentOnlyType === symbol.argumentOnlyType) {
          symbol.overridden = overload.asFunctionSymbol();

          if (symbol.kind !== Skew.SymbolKind.FUNCTION_CONSTRUCTOR && overload.kind !== Skew.SymbolKind.FUNCTION_CONSTRUCTOR && symbol.overridden.resolvedType.returnType !== returnType) {
            self.log.semanticErrorBadOverrideReturnType(symbol.range, symbol.name, symbol.parent.asObjectSymbol().base.resolvedType, overload.range);
            hasOverrideError = true;
          }

          break;
        }
      }
    }

    symbol.resolvedType.returnType = returnType;
    self.resolveAnnotations(symbol);

    // Validate use of "def" vs "over"
    if (!hasOverrideError) {
      if (symbol.overridden !== null && symbol.kind === Skew.SymbolKind.FUNCTION_INSTANCE) {
        if (!symbol.isOver()) {
          self.log.semanticErrorModifierMissingOverride(symbol.range, symbol.name, symbol.overridden.range);
        }
      }

      else if (symbol.isOver()) {
        self.log.semanticErrorModifierUnusedOverride(symbol.range, symbol.name);
      }
    }
  };

  Skew.Resolving.Resolver.prototype.automaticallyGenerateClassConstructor = function(symbol) {
    var self = this;
    var statements = [];

    // Mirror the base constructor's arguments
    if (symbol.overridden !== null) {
      self.initializeSymbol(symbol.overridden);
      var $arguments = symbol.overridden.$arguments;
      var values = [];

      for (var i = 0, list = $arguments, count = list.length; i < count; ++i) {
        var variable = list[i];
        var argument = new Skew.VariableSymbol(Skew.SymbolKind.VARIABLE_LOCAL, variable.name);
        argument.resolvedType = variable.resolvedType;
        argument.state = Skew.SymbolState.INITIALIZED;
        symbol.$arguments.push(argument);
        values.push(Skew.Resolving.Resolver.createSymbolReference(argument));
      }

      statements.push(Skew.Node.createExpression(values.length === 0 ? new Skew.Node(Skew.NodeKind.SUPER) : Skew.Node.createCall(new Skew.Node(Skew.NodeKind.SUPER), values)));
    }

    // Add an argument for every uninitialized variable
    var parent = symbol.parent.asObjectSymbol();
    self.initializeSymbol(parent);

    for (var i1 = 0, list1 = parent.variables, count1 = list1.length; i1 < count1; ++i1) {
      var variable1 = list1[i1];

      if (variable1.kind === Skew.SymbolKind.VARIABLE_INSTANCE) {
        self.initializeSymbol(variable1);

        if (variable1.value === null) {
          var argument1 = new Skew.VariableSymbol(Skew.SymbolKind.VARIABLE_LOCAL, variable1.name);
          argument1.resolvedType = variable1.resolvedType;
          argument1.state = Skew.SymbolState.INITIALIZED;
          symbol.$arguments.push(argument1);
          statements.push(Skew.Node.createExpression(Skew.Node.createBinary(Skew.NodeKind.ASSIGN, Skew.Resolving.Resolver.createMemberReference(Skew.Resolving.Resolver.createSymbolReference(symbol.self), variable1), Skew.Resolving.Resolver.createSymbolReference(argument1))));
        }

        else {
          statements.push(Skew.Node.createExpression(Skew.Node.createBinary(Skew.NodeKind.ASSIGN, Skew.Resolving.Resolver.createMemberReference(Skew.Resolving.Resolver.createSymbolReference(symbol.self), variable1), variable1.value)));
          variable1.value = null;
        }
      }
    }

    // Create the function body
    symbol.block = new Skew.Node(Skew.NodeKind.BLOCK).withChildren(statements);

    // Make constructors without arguments into getters
    if (symbol.$arguments.length === 0) {
      symbol.flags |= Skew.Symbol.IS_GETTER;
    }
  };

  Skew.Resolving.Resolver.prototype.automaticallyGenerateEnumToString = function(symbol) {
    var self = this;
    var parent = symbol.parent.asObjectSymbol();
    var names = [];
    self.initializeSymbol(parent);

    for (var i = 0, list = parent.variables, count = list.length; i < count; ++i) {
      var variable = list[i];

      if (variable.kind === Skew.SymbolKind.VARIABLE_ENUM) {
        assert(variable.value.content.asInt() === names.length);
        names.push(new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.StringContent(variable.name)));
      }
    }

    var strings = new Skew.VariableSymbol(Skew.SymbolKind.VARIABLE_GLOBAL, parent.scope.generateName("strings"));
    strings.value = Skew.Node.createInitializer(Skew.NodeKind.INITIALIZER_LIST, names);
    strings.flags |= Skew.Symbol.IS_PRIVATE | Skew.Symbol.IS_CONST;
    strings.state = Skew.SymbolState.INITIALIZED;
    strings.parent = parent;
    strings.scope = parent.scope;
    strings.resolvedType = self.cache.createListType(self.cache.stringType);
    parent.variables.push(strings);
    self.resolveAsParameterizedExpressionWithConversion(strings.value, strings.scope, strings.resolvedType);
    symbol.returnType = new Skew.Node(Skew.NodeKind.TYPE).withType(self.cache.stringType);
    symbol.block = new Skew.Node(Skew.NodeKind.BLOCK).withChildren([Skew.Node.createReturn(Skew.Node.createIndex(Skew.Resolving.Resolver.createSymbolReference(strings), [new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent("self"))]))]);
    symbol.flags |= Skew.Symbol.IS_GETTER;
  };

  Skew.Resolving.Resolver.prototype.resolveFunction = function(symbol) {
    var self = this;
    self.initializeSymbol(symbol);
    var scope = new Skew.LocalScope(symbol.scope, Skew.LocalType.NORMAL);

    if (symbol.self !== null) {
      scope.define(symbol.self, self.log);
    }

    // Default values for argument variables aren't resolved with this local
    // scope since they are evaluated at the call site, not inside the
    // function body, and shouldn't have access to other arguments
    for (var i = 0, list = symbol.$arguments, count = list.length; i < count; ++i) {
      var argument = list[i];
      scope.define(argument, self.log);
    }

    // The function is considered abstract if the body is missing
    var block = symbol.block;

    if (block !== null) {
      // User-specified constructors have variable initializers automatically inserted
      if (symbol.kind === Skew.SymbolKind.FUNCTION_CONSTRUCTOR && !symbol.isAutomaticallyGenerated()) {
        var index = 0;

        for (var i1 = 0, list1 = symbol.parent.asObjectSymbol().variables, count1 = list1.length; i1 < count1; ++i1) {
          var variable = list1[i1];

          if (variable.kind === Skew.SymbolKind.VARIABLE_INSTANCE) {
            self.initializeSymbol(variable);

            if (variable.value !== null) {
              block.insertChild(index, Skew.Node.createExpression(Skew.Node.createBinary(Skew.NodeKind.ASSIGN, Skew.Resolving.Resolver.createMemberReference(Skew.Resolving.Resolver.createSymbolReference(symbol.self), variable), variable.value)));
              ++index;
              variable.value = null;
            }
          }
        }
      }

      self.resolveNode(block, scope, null);

      // Missing a return statement is an error
      if (symbol.kind !== Skew.SymbolKind.FUNCTION_CONSTRUCTOR) {
        var returnType = symbol.resolvedType.returnType;

        if (returnType !== null && returnType !== Skew.Type.DYNAMIC && !block.blockAlwaysEndsWithReturn()) {
          self.log.semanticErrorMissingReturn(symbol.range, symbol.name, returnType);
        }
      }
    }
  };

  Skew.Resolving.Resolver.prototype.recordStatistic = function(symbol, statistic) {
    var self = this;

    if (symbol !== null && symbol.kind === Skew.SymbolKind.VARIABLE_LOCAL) {
      var info = in_IntMap.get(self.localVariableStatistics, symbol.id, null);

      if (info !== null) {
        switch (statistic) {
          case Skew.Resolving.SymbolStatistic.READ: {
            ++info.readCount;
            break;
          }

          case Skew.Resolving.SymbolStatistic.WRITE: {
            ++info.writeCount;
            break;
          }
        }
      }
    }
  };

  Skew.Resolving.Resolver.prototype.initializeVariable = function(symbol) {
    var self = this;
    self.forbidOverriddenSymbol(symbol);

    // Normal variables may omit the initializer if the type is present
    if (symbol.type !== null) {
      self.resolveAsParameterizedType(symbol.type, symbol.scope);
      symbol.resolvedType = symbol.type.resolvedType;

      // Resolve the constant now so initialized constants always have a value
      if (symbol.isConst() && symbol.value !== null) {
        self.resolveAsParameterizedExpressionWithConversion(symbol.value, symbol.scope, symbol.resolvedType);
      }
    }

    // Enums take their type from their parent
    else if (symbol.kind === Skew.SymbolKind.VARIABLE_ENUM) {
      symbol.resolvedType = symbol.parent.resolvedType;
    }

    // Implicitly-typed variables take their type from their initializer
    else if (symbol.value !== null) {
      self.resolveAsParameterizedExpression(symbol.value, symbol.scope);
      var type = symbol.value.resolvedType;
      symbol.resolvedType = type;

      // Forbid certain types
      if (!Skew.Resolving.Resolver.isValidVariableType(type)) {
        self.log.semanticErrorBadVariableType(symbol.range, type);
        symbol.resolvedType = Skew.Type.DYNAMIC;
      }
    }

    // Use a different error for constants which must have a type and lambda arguments which cannot have an initializer
    else if (symbol.isConst() || symbol.scope.kind() === Skew.ScopeKind.FUNCTION && symbol.scope.asFunctionScope().symbol.kind === Skew.SymbolKind.FUNCTION_LOCAL) {
      self.log.semanticErrorVarMissingType(symbol.range, symbol.name);
      symbol.resolvedType = Skew.Type.DYNAMIC;
    }

    // Variables without a type are an error
    else {
      self.log.semanticErrorVarMissingValue(symbol.range, symbol.name);
      symbol.resolvedType = Skew.Type.DYNAMIC;
    }

    self.resolveDefines(symbol);
    self.resolveAnnotations(symbol);

    // Run post-annotation checks
    if (symbol.resolvedType !== Skew.Type.DYNAMIC && symbol.isConst() && !symbol.isImported() && symbol.value === null && symbol.kind !== Skew.SymbolKind.VARIABLE_ENUM && symbol.kind !== Skew.SymbolKind.VARIABLE_INSTANCE) {
      self.log.semanticErrorConstMissingValue(symbol.range, symbol.name);
    }
  };

  Skew.Resolving.Resolver.prototype.resolveVariable = function(symbol) {
    var self = this;
    self.initializeSymbol(symbol);

    if (symbol.value !== null) {
      self.resolveAsParameterizedExpressionWithConversion(symbol.value, symbol.scope, symbol.resolvedType);
    }
  };

  Skew.Resolving.Resolver.prototype.initializeOverloadedFunction = function(symbol) {
    var self = this;
    var symbols = symbol.symbols;

    if (symbol.resolvedType === null) {
      symbol.resolvedType = new Skew.Type(Skew.TypeKind.SYMBOL, symbol);
    }

    // Ensure no two overloads have the same argument types
    var types = [];
    var i = 0;

    while (i < symbols.length) {
      var $function = symbols[i];
      self.initializeSymbol($function);
      var index = types.indexOf($function.argumentOnlyType);

      if (index !== -1) {
        var other = symbols[index];

        // Allow duplicate function declarations with the same type to merge
        // as long as there is one declaration that provides an implementation.
        // Mark the obsolete function as obsolete instead of removing it so it
        // doesn't potentially mess up iteration in a parent call stack.
        if ($function.isMerged() || other.isMerged() || $function.block !== null === (other.block !== null) || $function.resolvedType.returnType !== other.resolvedType.returnType) {
          self.log.semanticErrorDuplicateOverload($function.range, symbol.name, other.range);
        }

        else if ($function.block !== null) {
          $function.flags |= other.flags & ~Skew.Symbol.IS_IMPORTED | Skew.Symbol.IS_MERGED;
          $function.mergeAnnotationsAndCommentsFrom(other);
          other.flags |= Skew.Symbol.IS_OBSOLETE;
          symbols[index] = $function;
        }

        else {
          other.flags |= $function.flags & ~Skew.Symbol.IS_IMPORTED | Skew.Symbol.IS_MERGED;
          other.mergeAnnotationsAndCommentsFrom($function);
          $function.flags |= Skew.Symbol.IS_OBSOLETE;
        }

        // Remove the symbol after the merge so "types" still matches "symbols"
        symbols.splice(i, 1);
        continue;
      }

      types.push($function.argumentOnlyType);
      ++i;
    }

    // Include non-overridden overloads from the base class
    var overridden = self.findOverriddenMember(symbol);

    if (overridden !== null && Skew.SymbolKind.isOverloadedFunction(overridden.kind)) {
      symbol.overridden = overridden.asOverloadedFunctionSymbol();

      for (var i1 = 0, list = symbol.overridden.symbols, count = list.length; i1 < count; ++i1) {
        var function1 = list[i1];

        // Constructors are not inherited
        if (function1.kind !== Skew.SymbolKind.FUNCTION_CONSTRUCTOR) {
          self.initializeSymbol(function1);
          var index1 = types.indexOf(function1.argumentOnlyType);

          if (index1 === -1) {
            symbols.push(function1);
            types.push(function1.argumentOnlyType);
          }
        }
      }
    }
  };

  Skew.Resolving.Resolver.prototype.resolveNode = function(node, scope, context) {
    var self = this;

    if (node.resolvedType !== null) {
      // Only resolve once
      return;
    }

    node.resolvedType = Skew.Type.DYNAMIC;

    switch (node.kind) {
      case Skew.NodeKind.BLOCK: {
        self.resolveBlock(node, scope);
        break;
      }

      case Skew.NodeKind.PAIR: {
        self.resolvePair(node, scope);
        break;
      }

      case Skew.NodeKind.BREAK:
      case Skew.NodeKind.CONTINUE: {
        self.resolveJump(node, scope);
        break;
      }

      case Skew.NodeKind.EXPRESSION: {
        self.resolveExpression(node, scope);
        break;
      }

      case Skew.NodeKind.FOREACH: {
        self.resolveForeach(node, scope);
        break;
      }

      case Skew.NodeKind.IF: {
        self.resolveIf(node, scope);
        break;
      }

      case Skew.NodeKind.RETURN: {
        self.resolveReturn(node, scope);
        break;
      }

      case Skew.NodeKind.SWITCH: {
        self.resolveSwitch(node, scope);
        break;
      }

      case Skew.NodeKind.THROW: {
        self.resolveThrow(node, scope);
        break;
      }

      case Skew.NodeKind.TRY: {
        self.resolveTry(node, scope);
        break;
      }

      case Skew.NodeKind.VAR: {
        self.resolveVar(node, scope);
        break;
      }

      case Skew.NodeKind.WHILE: {
        self.resolveWhile(node, scope);
        break;
      }

      case Skew.NodeKind.ASSIGN_INDEX: {
        self.resolveIndex(node, scope);
        break;
      }

      case Skew.NodeKind.CALL: {
        self.resolveCall(node, scope);
        break;
      }

      case Skew.NodeKind.CAST: {
        self.resolveCast(node, scope, context);
        break;
      }

      case Skew.NodeKind.CONSTANT: {
        self.resolveConstant(node, scope);
        break;
      }

      case Skew.NodeKind.DOT: {
        self.resolveDot(node, scope, context);
        break;
      }

      case Skew.NodeKind.DYNAMIC: {
        break;
      }

      case Skew.NodeKind.HOOK: {
        self.resolveHook(node, scope, context);
        break;
      }

      case Skew.NodeKind.INDEX: {
        self.resolveIndex(node, scope);
        break;
      }

      case Skew.NodeKind.INITIALIZER_LIST:
      case Skew.NodeKind.INITIALIZER_MAP:
      case Skew.NodeKind.INITIALIZER_SET: {
        self.resolveInitializer(node, scope, context);
        break;
      }

      case Skew.NodeKind.LAMBDA: {
        self.resolveLambda(node, scope, context);
        break;
      }

      case Skew.NodeKind.LAMBDA_TYPE: {
        self.resolveLambdaType(node, scope);
        break;
      }

      case Skew.NodeKind.NAME: {
        self.resolveName(node, scope);
        break;
      }

      case Skew.NodeKind.NULL: {
        node.resolvedType = Skew.Type.NULL;
        break;
      }

      case Skew.NodeKind.PARAMETERIZE: {
        self.resolveParameterize(node, scope);
        break;
      }

      case Skew.NodeKind.SUPER: {
        self.resolveSuper(node, scope);
        break;
      }

      default: {
        if (Skew.NodeKind.isUnary(node.kind)) {
          self.resolveUnary(node, scope);
        }

        else if (Skew.NodeKind.isBinary(node.kind)) {
          self.resolveBinary(node, scope);
        }

        else {
          assert(false);
        }
        break;
      }
    }

    assert(node.resolvedType !== null);
  };

  Skew.Resolving.Resolver.prototype.resolveAsParameterizedType = function(node, scope) {
    var self = this;
    assert(Skew.NodeKind.isExpression(node.kind));
    self.resolveNode(node, scope, null);
    self.checkIsType(node);
    self.checkIsParameterized(node);
  };

  Skew.Resolving.Resolver.prototype.resolveAsParameterizedExpression = function(node, scope) {
    var self = this;
    assert(Skew.NodeKind.isExpression(node.kind));
    self.resolveNode(node, scope, null);
    self.checkIsInstance(node);
    self.checkIsParameterized(node);
  };

  Skew.Resolving.Resolver.prototype.resolveAsParameterizedExpressionWithTypeContext = function(node, scope, type) {
    var self = this;
    assert(Skew.NodeKind.isExpression(node.kind));
    self.resolveNode(node, scope, type);
    self.checkIsInstance(node);
    self.checkIsParameterized(node);
  };

  Skew.Resolving.Resolver.prototype.resolveAsParameterizedExpressionWithConversion = function(node, scope, type) {
    var self = this;
    self.resolveAsParameterizedExpressionWithTypeContext(node, scope, type);
    self.checkConversion(node, type, Skew.Resolving.ConversionKind.IMPLICIT);
  };

  Skew.Resolving.Resolver.prototype.resolveChildrenAsParameterizedExpressions = function(node, scope) {
    var self = this;

    for (var i = 0, list = node.children, count = list.length; i < count; ++i) {
      var child = list[i];
      self.resolveAsParameterizedExpression(child, scope);
    }
  };

  Skew.Resolving.Resolver.prototype.checkUnusedExpression = function(node) {
    var self = this;
    var kind = node.kind;

    if (kind === Skew.NodeKind.HOOK) {
      self.checkUnusedExpression(node.hookTrue());
      self.checkUnusedExpression(node.hookFalse());
    }

    else if (node.range !== null && node.resolvedType !== Skew.Type.DYNAMIC && kind !== Skew.NodeKind.CALL && !Skew.NodeKind.isBinaryAssign(kind)) {
      self.log.semanticWarningUnusedExpression(node.range);
    }
  };

  Skew.Resolving.Resolver.prototype.checkIsInstance = function(node) {
    var self = this;

    if (node.resolvedType !== Skew.Type.DYNAMIC && node.isType()) {
      self.log.semanticErrorUnexpectedType(node.range, node.resolvedType);
      node.resolvedType = Skew.Type.DYNAMIC;
    }
  };

  Skew.Resolving.Resolver.prototype.checkIsType = function(node) {
    var self = this;

    if (node.resolvedType !== Skew.Type.DYNAMIC && !node.isType()) {
      self.log.semanticErrorUnexpectedExpression(node.range, node.resolvedType);
      node.resolvedType = Skew.Type.DYNAMIC;
    }
  };

  Skew.Resolving.Resolver.prototype.checkIsParameterized = function(node) {
    var self = this;

    if (node.resolvedType.parameters() !== null && !node.resolvedType.isParameterized()) {
      self.log.semanticErrorUnparameterizedType(node.range, node.resolvedType);
      node.resolvedType = Skew.Type.DYNAMIC;
    }
  };

  Skew.Resolving.Resolver.prototype.checkStorage = function(node, scope) {
    var self = this;
    var symbol = node.symbol;

    // Only allow storage to variables
    if (node.kind !== Skew.NodeKind.NAME && node.kind !== Skew.NodeKind.DOT || symbol !== null && !Skew.SymbolKind.isVariable(symbol.kind)) {
      self.log.semanticErrorBadStorage(node.range);
    }

    // Forbid storage to constants
    else if (symbol !== null && symbol.isConst()) {
      var $function = scope.findEnclosingFunction();

      // Allow assignments to constants inside constructors
      if ($function === null || $function.symbol.kind !== Skew.SymbolKind.FUNCTION_CONSTRUCTOR || $function.symbol.parent !== symbol.parent || symbol.kind !== Skew.SymbolKind.VARIABLE_INSTANCE) {
        self.log.semanticErrorStorageToConstSymbol(node.internalRangeOrRange(), symbol.name);
      }
    }
  };

  Skew.Resolving.Resolver.prototype.checkAccess = function(node, range, scope) {
    var self = this;
    var symbol = node.symbol;

    if (symbol === null) {
      return;
    }

    // Check access control
    if (symbol.isPrivateOrProtected()) {
      var isPrivate = symbol.isPrivate();

      while (scope !== null) {
        if (scope.kind() === Skew.ScopeKind.OBJECT) {
          var object = scope.asObjectScope().symbol;

          if (object === symbol.parent || !isPrivate && object.hasBaseClass(symbol.parent)) {
            return;
          }
        }

        scope = scope.parent;
      }

      self.log.semanticErrorAccessViolation(range, isPrivate ? "@private" : "@protected", symbol.name);
    }

    // Deprecation annotations optionally provide a warning message
    if (symbol.isDeprecated()) {
      for (var i = 0, list = symbol.annotations, count = list.length; i < count; ++i) {
        var annotation = list[i];

        if (annotation.symbol !== null && annotation.symbol.fullName() === "@deprecated") {
          var value = annotation.annotationValue();

          if (value.kind === Skew.NodeKind.CALL) {
            var last = in_List.last(value.children);

            if (last.kind === Skew.NodeKind.CONSTANT && last.content.kind() === Skew.ContentKind.STRING) {
              self.log.warning(range, last.content.asString());
              return;
            }
          }
        }
      }

      self.log.semanticWarningDeprecatedUsage(range, symbol.name);
    }
  };

  Skew.Resolving.Resolver.prototype.checkConversion = function(node, to, kind) {
    var self = this;
    var from = node.resolvedType;
    assert(from !== null);
    assert(to !== null);

    // The "dynamic" type is a hole in the type system
    if (from === Skew.Type.DYNAMIC || to === Skew.Type.DYNAMIC) {
      return;
    }

    // No conversion is needed for identical types
    if (from === to) {
      return;
    }

    // The implicit conversion must be valid
    if (kind === Skew.Resolving.ConversionKind.IMPLICIT && !self.cache.canImplicitlyConvert(from, to) || kind === Skew.Resolving.ConversionKind.EXPLICIT && !self.cache.canExplicitlyConvert(from, to)) {
      self.log.semanticErrorIncompatibleTypes(node.range, from, to, self.cache.canExplicitlyConvert(from, to));
      node.resolvedType = Skew.Type.DYNAMIC;
      return;
    }

    // Make the implicit conversion explicit for convenience later on
    if (kind === Skew.Resolving.ConversionKind.IMPLICIT) {
      var value = new Skew.Node(Skew.NodeKind.NULL);
      value.become(node);
      node.become(Skew.Node.createCast(value, new Skew.Node(Skew.NodeKind.TYPE).withType(to)).withType(to).withRange(node.range));
    }
  };

  Skew.Resolving.Resolver.prototype.resolveAnnotation = function(node, symbol) {
    var self = this;
    var value = node.annotationValue();
    var test = node.annotationTest();
    self.resolveNode(value, symbol.scope, null);

    if (test !== null) {
      self.resolveAsParameterizedExpressionWithConversion(test, symbol.scope, self.cache.boolType);
    }

    // Terminate early when there were errors
    if (value.symbol === null) {
      return;
    }

    // Make sure annotations have the arguments they need
    if (value.kind !== Skew.NodeKind.CALL) {
      self.log.semanticErrorArgumentCount(value.range, value.symbol.resolvedType.argumentTypes.length, 0, value.symbol.name, value.symbol.range);
      return;
    }

    // Ensure all arguments are constants
    var children = value.children;
    var isValid = true;

    for (var i = 1, count = children.length; i < count; ++i) {
      isValid = isValid && self.recursivelyResolveAsConstant(children[i]);
    }

    if (!isValid) {
      return;
    }

    // Only store symbols for annotations with the correct arguments for ease of use
    node.symbol = value.symbol;

    // Apply built-in annotation logic
    var flag = in_StringMap.get(Skew.Resolving.Resolver.annotationSymbolFlags, value.symbol.fullName(), 0);

    if (flag !== 0) {
      switch (flag) {
        case Skew.Symbol.IS_DEPRECATED: {
          break;
        }

        case Skew.Symbol.IS_ENTRY_POINT: {
          isValid = symbol.kind === Skew.SymbolKind.FUNCTION_GLOBAL;
          break;
        }

        case Skew.Symbol.IS_EXPORTED: {
          isValid = !symbol.isImported();
          break;
        }

        case Skew.Symbol.IS_IMPORTED: {
          isValid = !symbol.isExported();
          break;
        }

        case Skew.Symbol.IS_PREFERRED: {
          isValid = Skew.SymbolKind.isFunction(symbol.kind);
          break;
        }

        case Skew.Symbol.IS_PRIVATE: {
          isValid = !symbol.isProtected() && symbol.parent !== null && symbol.parent.kind !== Skew.SymbolKind.OBJECT_GLOBAL;
          break;
        }

        case Skew.Symbol.IS_PROTECTED: {
          isValid = !symbol.isPrivate() && symbol.parent !== null && symbol.parent.kind !== Skew.SymbolKind.OBJECT_GLOBAL;
          break;
        }

        case Skew.Symbol.IS_RENAMED: {
          break;
        }

        case Skew.Symbol.IS_SKIPPED: {
          isValid = Skew.SymbolKind.isFunction(symbol.kind) && symbol.resolvedType.returnType === null;
          break;
        }
      }

      if (!isValid) {
        self.log.semanticErrorInvalidAnnotation(value.range, value.symbol.name, symbol.name);
      }

      else {
        // Don't add an annotation when the test expression is false
        if (test !== null && self.recursivelyResolveAsConstant(test) && test.isFalse()) {
          return;
        }

        // Only warn about duplicate annotations after checking the test expression
        if ((symbol.flags & flag) !== 0) {
          self.log.semanticErrorDuplicateAnnotation(value.range, value.symbol.name, symbol.name);
        }

        symbol.flags |= flag;
      }
    }
  };

  Skew.Resolving.Resolver.prototype.recursivelyResolveAsConstant = function(node) {
    var self = this;
    self.constantFolder.foldConstants(node);

    if (node.kind !== Skew.NodeKind.CONSTANT) {
      self.log.semanticErrorExpectedConstant(node.range);
      return false;
    }

    return true;
  };

  Skew.Resolving.Resolver.prototype.resolveBlock = function(node, scope) {
    var self = this;
    assert(node.kind === Skew.NodeKind.BLOCK);
    var children = node.children;
    var i = 0;

    while (i < children.length) {
      var child = children[i];

      // There is a well-known ambiguity in languages like JavaScript where
      // a return statement followed by a newline and a value can either be
      // parsed as a single return statement with a value or as two
      // statements, a return statement without a value and an expression
      // statement. Luckily, we're better off than JavaScript since we know
      // the type of the function. Parse a single statement in a non-void
      // function but two statements in a void function.
      if (child.kind === Skew.NodeKind.RETURN && (i + 1 | 0) < children.length && child.returnValue() === null && children[i + 1 | 0].kind === Skew.NodeKind.EXPRESSION) {
        var $function = scope.findEnclosingFunctionOrLambda().symbol;

        if ($function.kind !== Skew.SymbolKind.FUNCTION_CONSTRUCTOR && $function.resolvedType.returnType !== null) {
          child.replaceChild(0, node.removeChildAtIndex(i + 1 | 0).expressionValue().replaceWithNull());
        }
      }

      self.resolveNode(child, scope, null);

      // The "@skip" annotation removes function calls after type checking
      if (child.kind === Skew.NodeKind.EXPRESSION) {
        var value = child.expressionValue();

        if (value.kind === Skew.NodeKind.CALL && value.symbol !== null && value.symbol.isSkipped()) {
          node.removeChildAtIndex(i);
          continue;
        }
      }

      ++i;
    }
  };

  Skew.Resolving.Resolver.prototype.resolvePair = function(node, scope) {
    var self = this;
    self.resolveAsParameterizedExpression(node.firstValue(), scope);
    self.resolveAsParameterizedExpression(node.secondValue(), scope);
  };

  Skew.Resolving.Resolver.prototype.resolveJump = function(node, scope) {
    var self = this;

    if (scope.findEnclosingLoop() === null) {
      self.log.semanticErrorBadJump(node.range, node.kind === Skew.NodeKind.BREAK ? "break" : "continue");
    }
  };

  Skew.Resolving.Resolver.prototype.resolveExpression = function(node, scope) {
    var self = this;
    var value = node.expressionValue();
    self.resolveAsParameterizedExpression(value, scope);
    self.checkUnusedExpression(value);
  };

  Skew.Resolving.Resolver.prototype.resolveForeach = function(node, scope) {
    var self = this;
    var type = Skew.Type.DYNAMIC;
    scope = new Skew.LocalScope(scope, Skew.LocalType.LOOP);
    var value = node.foreachValue();
    self.resolveAsParameterizedExpression(value, scope);

    // Support "for i in 0..10"
    if (value.kind === Skew.NodeKind.PAIR) {
      var first = value.firstValue();
      var second = value.secondValue();
      type = self.cache.intType;
      self.checkConversion(first, self.cache.intType, Skew.Resolving.ConversionKind.IMPLICIT);
      self.checkConversion(second, self.cache.intType, Skew.Resolving.ConversionKind.IMPLICIT);

      // The ".." syntax only counts up, unlike CoffeeScript
      if (first.isInt() && second.isInt() && first.asInt() >= second.asInt()) {
        self.log.semanticWarningEmptyRange(value.range);
      }
    }

    // Support "for i in [1, 2, 3]"
    else if (self.cache.isList(value.resolvedType)) {
      type = value.resolvedType.substitutions[0];
    }

    // Anything else is an error
    else if (value.resolvedType !== Skew.Type.DYNAMIC) {
      self.log.semanticErrorBadForValue(value.range, value.resolvedType);
    }

    // Special-case symbol initialization with the type
    var symbol = node.symbol.asVariableSymbol();
    scope.asLocalScope().define(symbol, self.log);
    self.localVariableStatistics[symbol.id] = new Skew.Resolving.LocalVariableStatistics(symbol);
    symbol.resolvedType = type;
    symbol.flags |= Skew.Symbol.IS_CONST | Skew.Symbol.IS_LOOP_VARIABLE;
    symbol.state = Skew.SymbolState.INITIALIZED;
    self.resolveBlock(node.foreachBlock(), scope);

    // Collect foreach loops and convert them in another pass
    self.foreachLoops.push(node);
  };

  Skew.Resolving.Resolver.prototype.resolveIf = function(node, scope) {
    var self = this;
    var test = node.ifTest();
    var ifFalse = node.ifFalse();
    self.resolveAsParameterizedExpressionWithConversion(test, scope, self.cache.boolType);
    self.resolveBlock(node.ifTrue(), new Skew.LocalScope(scope, Skew.LocalType.NORMAL));

    if (ifFalse !== null) {
      self.resolveBlock(ifFalse, new Skew.LocalScope(scope, Skew.LocalType.NORMAL));
    }
  };

  Skew.Resolving.Resolver.prototype.resolveReturn = function(node, scope) {
    var self = this;
    var value = node.returnValue();
    var $function = scope.findEnclosingFunctionOrLambda().symbol;
    var returnType = $function.kind !== Skew.SymbolKind.FUNCTION_CONSTRUCTOR ? $function.resolvedType.returnType : null;

    // Check for a returned value
    if (value === null) {
      if (returnType !== null) {
        self.log.semanticErrorExpectedReturnValue(node.range, returnType);
      }

      return;
    }

    // Check the type of the returned value
    if (returnType !== null) {
      self.resolveAsParameterizedExpressionWithConversion(value, scope, returnType);
      return;
    }

    // If there's no return type, still check for other errors
    self.resolveAsParameterizedExpression(value, scope);

    // Lambdas without a return type or an explicit "return" statement get special treatment
    if (!node.isImplicitReturn()) {
      self.log.semanticErrorUnexpectedReturnValue(value.range);
      return;
    }

    // Check for a return value of type "void"
    if (!$function.shouldInferReturnType() || value.kind === Skew.NodeKind.CALL && value.symbol !== null && value.symbol.resolvedType.returnType === null) {
      self.checkUnusedExpression(value);
      node.kind = Skew.NodeKind.EXPRESSION;
      return;
    }

    // Check for an invalid return type
    var type = value.resolvedType;

    if (!Skew.Resolving.Resolver.isValidVariableType(type)) {
      self.log.semanticErrorBadReturnType(value.range, type);
      node.kind = Skew.NodeKind.EXPRESSION;
      return;
    }

    // Mutate the return type to the type from the returned value
    $function.returnType = new Skew.Node(Skew.NodeKind.TYPE).withType(type);
  };

  Skew.Resolving.Resolver.prototype.resolveSwitch = function(node, scope) {
    var self = this;
    var value = node.switchValue();
    var cases = node.children;
    self.resolveAsParameterizedExpression(value, scope);

    for (var i = 1, count1 = cases.length; i < count1; ++i) {
      var child = cases[i];
      var values = child.children;

      for (var j = 1, count = values.length; j < count; ++j) {
        var caseValue = values[j];
        self.resolveAsParameterizedExpressionWithConversion(caseValue, scope, value.resolvedType);
      }

      self.resolveBlock(child.caseBlock(), new Skew.LocalScope(scope, Skew.LocalType.NORMAL));
    }
  };

  Skew.Resolving.Resolver.prototype.resolveThrow = function(node, scope) {
    var self = this;
    var value = node.throwValue();
    self.resolveAsParameterizedExpression(value, scope);
  };

  Skew.Resolving.Resolver.prototype.resolveVar = function(node, scope) {
    var self = this;
    var symbol = node.symbol.asVariableSymbol();
    scope.asLocalScope().define(symbol, self.log);
    self.localVariableStatistics[symbol.id] = new Skew.Resolving.LocalVariableStatistics(symbol);
    self.resolveVariable(symbol);
  };

  Skew.Resolving.Resolver.prototype.resolveTry = function(node, scope) {
    var self = this;
    var children = node.children;
    var finallyBlock = node.finallyBlock();
    self.resolveBlock(node.tryBlock(), new Skew.LocalScope(scope, Skew.LocalType.NORMAL));

    // Bare try statements catch all thrown values
    if (children.length === 2 && finallyBlock === null) {
      node.insertChild(1, Skew.Node.createCatch(null, new Skew.Node(Skew.NodeKind.BLOCK).withChildren([])));
    }

    for (var i = 1, count = children.length - 1 | 0; i < count; ++i) {
      var child = children[i];
      var childScope = new Skew.LocalScope(scope, Skew.LocalType.NORMAL);

      if (child.symbol !== null) {
        var symbol = child.symbol.asVariableSymbol();
        scope.asLocalScope().define(symbol, self.log);
        self.resolveVariable(symbol);
      }

      self.resolveBlock(child.catchBlock(), childScope);
    }

    if (finallyBlock !== null) {
      self.resolveBlock(finallyBlock, new Skew.LocalScope(scope, Skew.LocalType.NORMAL));
    }
  };

  Skew.Resolving.Resolver.prototype.resolveWhile = function(node, scope) {
    var self = this;
    var test = node.whileTest();
    self.resolveAsParameterizedExpressionWithConversion(test, scope, self.cache.boolType);
    self.resolveBlock(node.whileBlock(), new Skew.LocalScope(scope, Skew.LocalType.LOOP));
  };

  Skew.Resolving.Resolver.prototype.resolveCall = function(node, scope) {
    var self = this;
    var value = node.callValue();
    self.resolveAsParameterizedExpression(value, scope);
    var type = value.resolvedType;

    switch (type.kind) {
      case Skew.TypeKind.SYMBOL: {
        if (self.resolveSymbolCall(node, scope, type)) {
          return;
        }
        break;
      }

      case Skew.TypeKind.LAMBDA: {
        if (self.resolveFunctionCall(node, scope, type)) {
          return;
        }
        break;
      }

      default: {
        if (type !== Skew.Type.DYNAMIC) {
          self.log.semanticErrorInvalidCall(node.internalRangeOrRange(), value.resolvedType);
        }
        break;
      }
    }

    // If there was an error, resolve the arguments to check for further
    // errors but use a dynamic type context to avoid introducing errors
    for (var i = 1, count = node.children.length; i < count; ++i) {
      self.resolveAsParameterizedExpressionWithConversion(node.children[i], scope, Skew.Type.DYNAMIC);
    }
  };

  Skew.Resolving.Resolver.prototype.resolveSymbolCall = function(node, scope, type) {
    var self = this;
    var symbol = type.symbol;

    // Getters are called implicitly, so explicitly calling one is an error.
    // This error prevents a getter returning a lambda which is then called,
    // but that's really strange and I think this error is more useful.
    if (symbol.isGetter() && Skew.Resolving.Resolver.isCallValue(node)) {
      self.log.semanticErrorGetterCalledTwice(node.parent.internalRangeOrRange(), symbol.name, symbol.range);
      return false;
    }

    // Check for calling a function directly
    if (Skew.SymbolKind.isFunction(symbol.kind)) {
      return self.resolveFunctionCall(node, scope, type);
    }

    // Check for calling a set of functions, must not be ambiguous
    if (Skew.SymbolKind.isOverloadedFunction(symbol.kind)) {
      return self.resolveOverloadedFunctionCall(node, scope, type);
    }

    // Can't call other symbols
    self.log.semanticErrorInvalidCall(node.internalRangeOrRange(), node.callValue().resolvedType);
    return false;
  };

  Skew.Resolving.Resolver.prototype.resolveFunctionCall = function(node, scope, type) {
    var self = this;
    var $function = type.symbol !== null ? type.symbol.asFunctionSymbol() : null;
    var expected = type.argumentTypes.length;
    var count = node.children.length - 1 | 0;
    node.symbol = $function;

    // Use the return type even if there were errors
    if (type.returnType !== null) {
      node.resolvedType = type.returnType;
    }

    // There is no "void" type, so make sure this return value isn't used
    else if (Skew.Resolving.Resolver.isVoidExpressionUsed(node)) {
      if ($function !== null) {
        self.log.semanticErrorUseOfVoidFunction(node.range, $function.name, $function.range);
      }

      else {
        self.log.semanticErrorUseOfVoidLambda(node.range);
      }
    }

    // Check argument count
    if (expected !== count) {
      self.log.semanticErrorArgumentCount(node.internalRangeOrRange(), expected, count, $function !== null ? $function.name : "", $function !== null ? $function.range : null);
      return false;
    }

    // Check argument types
    for (var i = 0, count1 = count; i < count1; ++i) {
      self.resolveAsParameterizedExpressionWithConversion(node.children[i + 1 | 0], scope, type.argumentTypes[i]);
    }

    // Replace overloaded symbols with the chosen overload
    var callValue = node.children[0];

    if ($function !== null && $function.overloaded !== null && callValue.symbol === $function.overloaded) {
      callValue.symbol = $function;
    }

    return true;
  };

  Skew.Resolving.Resolver.prototype.resolveOverloadedFunction = function(range, children, scope, symbolType) {
    var self = this;
    var overloaded = symbolType.symbol.asOverloadedFunctionSymbol();
    var count = children.length - 1 | 0;
    var candidates = [];

    // Filter by argument length and substitute using the current type environment
    for (var i1 = 0, list = overloaded.symbols, count1 = list.length; i1 < count1; ++i1) {
      var symbol = list[i1];

      if (symbol.$arguments.length === count || overloaded.symbols.length === 1) {
        candidates.push(self.cache.substitute(symbol.resolvedType, symbolType.environment));
      }
    }

    // Check for matches
    if (candidates.length === 0) {
      self.log.semanticErrorNoMatchingOverload(range, overloaded.name, count, null);
      return null;
    }

    // Check for an unambiguous match
    if (candidates.length === 1) {
      return candidates[0];
    }

    // First filter by syntactic structure impossibilities. This helps break
    // the chicken-and-egg problem of needing to resolve argument types to
    // get a match and needing a match to resolve argument types. For example,
    // a list literal needs type context to resolve correctly.
    var index = 0;

    while (index < candidates.length) {
      var argumentTypes = candidates[index].argumentTypes;

      for (var i = 0, count2 = count; i < count2; ++i) {
        var kind = children[i + 1 | 0].kind;
        var type = argumentTypes[i];

        if (kind === Skew.NodeKind.NULL && !type.isReference() || kind === Skew.NodeKind.INITIALIZER_LIST && self.findMember(type, "[new]") === null && self.findMember(type, "[...]") === null || (kind === Skew.NodeKind.INITIALIZER_SET || kind === Skew.NodeKind.INITIALIZER_MAP) && self.findMember(type, "{new}") === null && self.findMember(type, "{...}") === null) {
          candidates.splice(index, 1);
          --index;
          break;
        }
      }

      ++index;
    }

    // Check for an unambiguous match
    if (candidates.length === 1) {
      return candidates[0];
    }

    // If that still didn't work, resolve the arguments without type context
    for (var i4 = 0, count3 = count; i4 < count3; ++i4) {
      self.resolveAsParameterizedExpression(children[i4 + 1 | 0], scope);
    }

    // Try again, this time discarding all implicit conversion failures
    index = 0;

    while (index < candidates.length) {
      var argumentTypes1 = candidates[index].argumentTypes;

      for (var i5 = 0, count4 = count; i5 < count4; ++i5) {
        if (!self.cache.canImplicitlyConvert(children[i5 + 1 | 0].resolvedType, argumentTypes1[i5])) {
          candidates.splice(index, 1);
          --index;
          break;
        }
      }

      ++index;
    }

    // Check for an unambiguous match
    if (candidates.length === 1) {
      return candidates[0];
    }

    // Extract argument types for an error if there is one
    var childTypes = [];

    for (var i6 = 0, count5 = count; i6 < count5; ++i6) {
      childTypes.push(children[i6 + 1 | 0].resolvedType);
    }

    // Give up without a match
    if (candidates.length === 0) {
      self.log.semanticErrorNoMatchingOverload(range, overloaded.name, count, childTypes);
      return null;
    }

    // If that still didn't work, try type equality
    for (var i2 = 0, list1 = candidates, count7 = list1.length; i2 < count7; ++i2) {
      var type1 = list1[i2];
      var isMatch = true;

      for (var i7 = 0, count6 = count; i7 < count6; ++i7) {
        if (children[i7 + 1 | 0].resolvedType !== type1.argumentTypes[i7]) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        return type1;
      }
    }

    // If that still didn't work, try picking the preferred overload
    var firstPreferred = null;
    var secondPreferred = null;

    for (var i3 = 0, list2 = candidates, count8 = list2.length; i3 < count8; ++i3) {
      var type2 = list2[i3];

      if (type2.symbol.isPreferred()) {
        secondPreferred = firstPreferred;
        firstPreferred = type2;
      }
    }

    // Check for a single preferred overload
    if (firstPreferred !== null && secondPreferred === null) {
      return firstPreferred;
    }

    // Give up since the overload is ambiguous
    self.log.semanticErrorAmbiguousOverload(range, overloaded.name, count, childTypes);
    return null;
  };

  Skew.Resolving.Resolver.prototype.resolveOverloadedFunctionCall = function(node, scope, type) {
    var self = this;
    var match = self.resolveOverloadedFunction(node.callValue().range, node.children, scope, type);

    if (match !== null && self.resolveFunctionCall(node, scope, match)) {
      self.checkAccess(node, node.callValue().internalRangeOrRange(), scope);
      return true;
    }

    return false;
  };

  Skew.Resolving.Resolver.prototype.resolveCast = function(node, scope, context) {
    var self = this;
    var value = node.castValue();
    var type = node.castType();
    self.resolveAsParameterizedType(type, scope);
    self.resolveAsParameterizedExpressionWithTypeContext(value, scope, type.resolvedType);
    self.checkConversion(value, type.resolvedType, Skew.Resolving.ConversionKind.EXPLICIT);
    node.resolvedType = type.resolvedType;

    // Warn about unnecessary casts
    if (type.resolvedType !== Skew.Type.DYNAMIC && (value.resolvedType === type.resolvedType || context === type.resolvedType && self.cache.canImplicitlyConvert(value.resolvedType, type.resolvedType))) {
      self.log.semanticWarningExtraCast(Skew.Range.span(node.internalRangeOrRange(), type.range), value.resolvedType, type.resolvedType);
    }
  };

  Skew.Resolving.Resolver.prototype.resolveConstant = function(node, scope) {
    var self = this;

    switch (node.content.kind()) {
      case Skew.ContentKind.BOOL: {
        node.resolvedType = self.cache.boolType;
        break;
      }

      case Skew.ContentKind.DOUBLE: {
        node.resolvedType = self.cache.doubleType;
        break;
      }

      case Skew.ContentKind.INT: {
        node.resolvedType = self.cache.intType;
        break;
      }

      case Skew.ContentKind.STRING: {
        node.resolvedType = self.cache.stringType;
        break;
      }

      default: {
        assert(false);
        break;
      }
    }
  };

  Skew.Resolving.Resolver.prototype.findOverriddenMember = function(symbol) {
    var self = this;

    if (symbol.parent !== null && symbol.parent.kind === Skew.SymbolKind.OBJECT_CLASS) {
      var object = symbol.parent.asObjectSymbol();

      if (object.baseClass !== null) {
        return self.findMember(object.baseClass.resolvedType, symbol.name);
      }
    }

    return null;
  };

  Skew.Resolving.Resolver.prototype.forbidOverriddenSymbol = function(symbol) {
    var self = this;
    var overridden = self.findOverriddenMember(symbol);

    if (overridden !== null) {
      self.log.semanticErrorBadOverride(symbol.range, symbol.name, symbol.parent.asObjectSymbol().base.resolvedType, overridden.range);
    }
  };

  Skew.Resolving.Resolver.prototype.findMember = function(type, name) {
    var self = this;
    var check = type;

    while (check !== null) {
      if (check.kind === Skew.TypeKind.SYMBOL) {
        var symbol = check.symbol;

        if (Skew.SymbolKind.isObject(symbol.kind)) {
          var member = in_StringMap.get(symbol.asObjectSymbol().members, name, null);

          if (member !== null) {
            self.initializeSymbol(member);
            return member;
          }
        }
      }

      check = check.baseClass();
    }

    return null;
  };

  Skew.Resolving.Resolver.prototype.resolveDot = function(node, scope, context) {
    var self = this;
    var target = node.dotTarget();
    var name = node.asString();

    // Infer the target from the type context if it's omitted
    if (target === null) {
      if (context === null) {
        self.log.semanticErrorMissingDotContext(node.range, name);
        return;
      }

      target = new Skew.Node(Skew.NodeKind.TYPE).withType(context);
      node.replaceChild(0, target);
    }

    else {
      self.resolveNode(target, scope, null);
    }

    // Search for a setter first, then search for a normal member
    var symbol = null;

    if (Skew.Resolving.Resolver.shouldCheckForSetter(node)) {
      symbol = self.findMember(target.resolvedType, name + "=");
    }

    if (symbol === null) {
      symbol = self.findMember(target.resolvedType, name);

      if (symbol === null) {
        if (target.resolvedType !== Skew.Type.DYNAMIC) {
          self.reportGuardMergingFailure(node);
          self.log.semanticErrorUnknownMemberSymbol(node.internalRangeOrRange(), name, target.resolvedType);
        }

        if (target.kind === Skew.NodeKind.DYNAMIC) {
          node.kind = Skew.NodeKind.NAME;
          node.removeChildren();
        }

        return;
      }
    }

    // Forbid referencing a base class global or constructor function from a derived class
    if (Skew.Resolving.Resolver.isBaseGlobalReference(target.resolvedType.symbol, symbol)) {
      self.log.semanticErrorUnknownMemberSymbol(node.internalRangeOrRange(), name, target.resolvedType);
      return;
    }

    var isType = target.isType();
    var needsType = !Skew.SymbolKind.isOnInstances(symbol.kind);

    // Make sure the global/instance context matches the intended usage
    if (isType) {
      if (!needsType) {
        self.log.semanticErrorMemberUnexpectedInstance(node.internalRangeOrRange(), symbol.name);
      }

      else if (Skew.SymbolKind.isFunctionOrOverloadedFunction(symbol.kind)) {
        self.checkIsParameterized(target);
      }

      else if (target.resolvedType.isParameterized()) {
        self.log.semanticErrorParameterizedType(target.range, target.resolvedType);
      }
    }

    else if (needsType) {
      self.log.semanticErrorMemberUnexpectedGlobal(node.internalRangeOrRange(), symbol.name);
    }

    // Always access referenced globals directly
    if (Skew.SymbolKind.isGlobalReference(symbol.kind)) {
      node.kind = Skew.NodeKind.NAME;
      node.removeChildren();
    }

    node.symbol = symbol;
    node.resolvedType = self.cache.substitute(symbol.resolvedType, target.resolvedType.environment);
    self.automaticallyCallGetter(node, scope);
  };

  Skew.Resolving.Resolver.prototype.resolveHook = function(node, scope, context) {
    var self = this;
    self.resolveAsParameterizedExpressionWithConversion(node.hookTest(), scope, self.cache.boolType);
    var trueValue = node.hookTrue();
    var falseValue = node.hookFalse();

    // Use the type context from the parent
    if (context !== null) {
      self.resolveAsParameterizedExpressionWithConversion(trueValue, scope, context);
      self.resolveAsParameterizedExpressionWithConversion(falseValue, scope, context);
      node.resolvedType = context;
    }

    // Find the common type from both branches
    else {
      self.resolveAsParameterizedExpression(trueValue, scope);
      self.resolveAsParameterizedExpression(falseValue, scope);
      var common = self.cache.commonImplicitType(trueValue.resolvedType, falseValue.resolvedType);

      if (common !== null) {
        node.resolvedType = common;
      }

      else {
        self.log.semanticErrorNoCommonType(Skew.Range.span(trueValue.range, falseValue.range), trueValue.resolvedType, falseValue.resolvedType);
      }
    }
  };

  Skew.Resolving.Resolver.prototype.resolveInitializer = function(node, scope, context) {
    var self = this;

    // Make sure to resolve the children even if the initializer is invalid
    if (context !== null) {
      if (context === Skew.Type.DYNAMIC || !self.resolveInitializerWithContext(node, scope, context)) {
        self.resolveChildrenAsParameterizedExpressions(node, scope);
      }

      return;
    }

    // First pass: only children with type context, second pass: all children
    for (var pass = 0; pass < 2; ++pass) {
      switch (node.kind) {
        case Skew.NodeKind.INITIALIZER_LIST: {
          var type = null;

          // Resolve all children for this pass
          for (var i = 0, list = node.children, count = list.length; i < count; ++i) {
            var child = list[i];

            if (pass !== 0 || !Skew.Resolving.Resolver.needsTypeContext(child)) {
              self.resolveAsParameterizedExpression(child, scope);
              type = self.mergeCommonType(type, child);
            }
          }

          // Resolve remaining children using the type context if valid
          if (type !== null && Skew.Resolving.Resolver.isValidVariableType(type)) {
            self.resolveInitializerWithContext(node, scope, self.cache.createListType(type));
            return;
          }
          break;
        }

        case Skew.NodeKind.INITIALIZER_MAP: {
          var keyType = null;
          var valueType = null;

          // Resolve all children for this pass
          for (var i1 = 0, list1 = node.children, count1 = list1.length; i1 < count1; ++i1) {
            var child1 = list1[i1];
            var key = child1.firstValue();
            var value = child1.secondValue();

            if (pass !== 0 || !Skew.Resolving.Resolver.needsTypeContext(key)) {
              self.resolveAsParameterizedExpression(key, scope);
              keyType = self.mergeCommonType(keyType, key);
            }

            if (pass !== 0 || !Skew.Resolving.Resolver.needsTypeContext(value)) {
              self.resolveAsParameterizedExpression(value, scope);
              valueType = self.mergeCommonType(valueType, value);
            }
          }

          // Resolve remaining children using the type context if valid
          if (keyType !== null && valueType !== null && Skew.Resolving.Resolver.isValidVariableType(keyType) && Skew.Resolving.Resolver.isValidVariableType(valueType)) {
            if (keyType === self.cache.intType) {
              self.resolveInitializerWithContext(node, scope, self.cache.createIntMapType(valueType));
              return;
            }

            if (keyType === self.cache.stringType) {
              self.resolveInitializerWithContext(node, scope, self.cache.createStringMapType(valueType));
              return;
            }
          }
          break;
        }
      }
    }

    self.log.semanticErrorInitializerTypeInferenceFailed(node.range);
  };

  Skew.Resolving.Resolver.prototype.shouldUseMapConstructor = function(symbol) {
    var self = this;

    if (Skew.SymbolKind.isFunction(symbol.kind)) {
      return symbol.asFunctionSymbol().$arguments.length === 2;
    }

    for (var i = 0, list = symbol.asOverloadedFunctionSymbol().symbols, count = list.length; i < count; ++i) {
      var overload = list[i];

      if (overload.$arguments.length === 2) {
        return true;
      }
    }

    return false;
  };

  Skew.Resolving.Resolver.prototype.resolveInitializerWithContext = function(node, scope, context) {
    var self = this;
    var isList = node.kind === Skew.NodeKind.INITIALIZER_LIST;
    var create = self.findMember(context, isList ? "[new]" : "{new}");
    var add = self.findMember(context, isList ? "[...]" : "{...}");

    // Special-case imported literals to prevent an infinite loop for list literals
    if (add !== null && add.isImported()) {
      var $function = add.asFunctionSymbol();

      if ($function.$arguments.length === (isList ? 1 : 2)) {
        var functionType = self.cache.substitute($function.resolvedType, context.environment);

        for (var i = 0, list = node.children, count = list.length; i < count; ++i) {
          var child = list[i];

          if (child.kind === Skew.NodeKind.PAIR) {
            self.resolveAsParameterizedExpressionWithConversion(child.firstValue(), scope, functionType.argumentTypes[0]);
            self.resolveAsParameterizedExpressionWithConversion(child.secondValue(), scope, functionType.argumentTypes[1]);
          }

          else {
            self.resolveAsParameterizedExpressionWithConversion(child, scope, functionType.argumentTypes[0]);
          }
        }

        node.resolvedType = context;
        return true;
      }
    }

    // Use simple call chaining when there's an add operator present
    if (add !== null) {
      var chain = new Skew.Node(Skew.NodeKind.DOT).withContent(new Skew.StringContent(create !== null ? create.name : "new")).withChildren([new Skew.Node(Skew.NodeKind.TYPE).withType(context).withRange(node.range)]).withRange(node.range);

      for (var i1 = 0, list1 = node.children, count1 = list1.length; i1 < count1; ++i1) {
        var child1 = list1[i1];
        var dot = new Skew.Node(Skew.NodeKind.DOT).withContent(new Skew.StringContent(add.name)).withChildren([chain]).withRange(child1.range);
        var $arguments = child1.kind === Skew.NodeKind.PAIR ? [child1.firstValue().replaceWithNull(), child1.secondValue().replaceWithNull()] : [child1.replaceWithNull()];
        chain = Skew.Node.createCall(dot, $arguments).withRange(child1.range);
      }

      node.become(chain);
      self.resolveAsParameterizedExpressionWithConversion(node, scope, context);
      return true;
    }

    // Make sure there's a constructor to call
    if (create === null) {
      self.log.semanticErrorInitializerTypeInferenceFailed(node.range);
      return false;
    }

    var dot1 = new Skew.Node(Skew.NodeKind.DOT).withContent(new Skew.StringContent(create.name)).withChildren([new Skew.Node(Skew.NodeKind.TYPE).withType(context).withRange(node.range)]).withRange(node.range);

    // The literal "{}" is ambiguous and may be a map or a set
    if (node.children.length === 0 && !isList && self.shouldUseMapConstructor(create)) {
      node.become(Skew.Node.createCall(dot1, [new Skew.Node(Skew.NodeKind.INITIALIZER_LIST).withChildren([]).withRange(node.range), new Skew.Node(Skew.NodeKind.INITIALIZER_LIST).withChildren([]).withRange(node.range)]).withRange(node.range));
      self.resolveAsParameterizedExpressionWithConversion(node, scope, context);
      return true;
    }

    // Call the initializer constructor
    if (node.kind === Skew.NodeKind.INITIALIZER_MAP) {
      var firstValues = [];
      var secondValues = [];

      for (var i2 = 0, list2 = node.children, count2 = list2.length; i2 < count2; ++i2) {
        var child2 = list2[i2];
        firstValues.push(child2.firstValue().replaceWithNull());
        secondValues.push(child2.secondValue().replaceWithNull());
      }

      node.become(Skew.Node.createCall(dot1, [new Skew.Node(Skew.NodeKind.INITIALIZER_LIST).withChildren(firstValues).withRange(node.range), new Skew.Node(Skew.NodeKind.INITIALIZER_LIST).withChildren(secondValues).withRange(node.range)]).withRange(node.range));
    }

    else {
      node.become(Skew.Node.createCall(dot1, [new Skew.Node(Skew.NodeKind.INITIALIZER_LIST).withChildren(node.removeChildren()).withRange(node.range)]).withRange(node.range));
    }

    self.resolveAsParameterizedExpressionWithConversion(node, scope, context);
    return true;
  };

  Skew.Resolving.Resolver.prototype.mergeCommonType = function(commonType, child) {
    var self = this;

    if (commonType === null || child.resolvedType === Skew.Type.DYNAMIC) {
      return child.resolvedType;
    }

    var result = self.cache.commonImplicitType(commonType, child.resolvedType);

    if (result !== null) {
      return result;
    }

    self.log.semanticErrorNoCommonType(child.range, commonType, child.resolvedType);
    return Skew.Type.DYNAMIC;
  };

  Skew.Resolving.Resolver.prototype.resolveLambda = function(node, scope, context) {
    var self = this;
    var symbol = node.symbol.asFunctionSymbol();
    symbol.scope = new Skew.FunctionScope(scope, symbol);

    // Use type context to implicitly set missing types
    if (context !== null && context.kind === Skew.TypeKind.LAMBDA) {
      // Copy over the argument types if they line up
      if (context.argumentTypes.length === symbol.$arguments.length) {
        for (var i = 0, count = symbol.$arguments.length; i < count; ++i) {
          var argument = symbol.$arguments[i];

          if (argument.type === null) {
            argument.type = new Skew.Node(Skew.NodeKind.TYPE).withType(context.argumentTypes[i]);
          }
        }
      }

      // Copy over the return type
      if (symbol.returnType === null && context.returnType !== null) {
        symbol.returnType = new Skew.Node(Skew.NodeKind.TYPE).withType(context.returnType);
      }
    }

    // Only infer non-void return types if there's no type context
    else if (symbol.returnType === null) {
      symbol.flags |= Skew.Symbol.SHOULD_INFER_RETURN_TYPE;
    }

    self.resolveFunction(symbol);

    // Use a LambdaType instead of a SymbolType for the node
    var argumentTypes = [];
    var returnType = symbol.returnType;

    for (var i1 = 0, list = symbol.$arguments, count1 = list.length; i1 < count1; ++i1) {
      var argument1 = list[i1];
      argumentTypes.push(argument1.resolvedType);
    }

    node.resolvedType = self.cache.createLambdaType(argumentTypes, returnType !== null ? returnType.resolvedType : null);
  };

  Skew.Resolving.Resolver.prototype.resolveLambdaType = function(node, scope) {
    var self = this;
    var types = [];

    for (var i = 0, list = node.children, count = list.length; i < count; ++i) {
      var child = list[i];

      if (child !== null) {
        self.resolveAsParameterizedType(child, scope);
        types.push(child.resolvedType);
      }

      else {
        types.push(null);
      }
    }

    var returnType = types.pop();
    node.resolvedType = self.cache.createLambdaType(types, returnType);
  };

  Skew.Resolving.Resolver.prototype.resolveName = function(node, scope) {
    var self = this;
    var enclosingFunction = scope.findEnclosingFunction();
    var name = node.asString();
    var symbol = null;

    // Search for a setter first, then search for a normal symbol
    if (Skew.Resolving.Resolver.shouldCheckForSetter(node)) {
      symbol = scope.find(name + "=");
    }

    // If a setter wasn't found, search for a normal symbol
    if (symbol === null) {
      symbol = scope.find(name);

      if (symbol === null) {
        self.reportGuardMergingFailure(node);
        self.log.semanticErrorUndeclaredSymbol(node.range, name);
        return;
      }
    }

    self.initializeSymbol(symbol);

    // Track reads and writes of local variables for later use
    self.recordStatistic(symbol, node.isAssignTarget() ? Skew.Resolving.SymbolStatistic.WRITE : Skew.Resolving.SymbolStatistic.READ);

    // Forbid referencing a base class global or constructor function from a derived class
    if (enclosingFunction !== null && Skew.Resolving.Resolver.isBaseGlobalReference(enclosingFunction.symbol.parent, symbol)) {
      self.log.semanticErrorUndeclaredSymbol(node.range, name);
      return;
    }

    // Automatically insert "self." before instance symbols
    if (Skew.SymbolKind.isOnInstances(symbol.kind)) {
      var variable = enclosingFunction !== null ? enclosingFunction.symbol.self : null;

      if (variable !== null) {
        node.withChildren([Skew.Resolving.Resolver.createSymbolReference(variable)]).kind = Skew.NodeKind.DOT;
      }

      else {
        self.log.semanticErrorMemberUnexpectedInstance(node.range, symbol.name);
      }
    }

    // Type parameters for objects may only be used in certain circumstances
    else if (symbol.kind === Skew.SymbolKind.PARAMETER_OBJECT) {
      var parent = scope;
      var isValid = false;
      var stop = false;

      while (parent !== null) {
        switch (parent.kind()) {
          case Skew.ScopeKind.OBJECT: {
            isValid = parent.asObjectScope().symbol === symbol.parent;
            stop = true;
            break;
          }

          case Skew.ScopeKind.FUNCTION: {
            var $function = parent.asFunctionScope().symbol;

            if ($function.kind !== Skew.SymbolKind.FUNCTION_LOCAL) {
              isValid = $function.parent === symbol.parent;
              stop = true;
            }
            break;
          }

          case Skew.ScopeKind.VARIABLE: {
            var variable1 = parent.asVariableScope().symbol;
            isValid = variable1.kind === Skew.SymbolKind.VARIABLE_INSTANCE && variable1.parent === symbol.parent;
            stop = true;
            break;
          }
        }

        // TODO: Should be able to use "break" above
        if (stop) {
          break;
        }

        parent = parent.parent;
      }

      if (!isValid) {
        self.log.semanticErrorMemberUnexpectedTypeParameter(node.range, symbol.name);
      }
    }

    node.symbol = symbol;
    node.resolvedType = symbol.resolvedType;
    self.automaticallyCallGetter(node, scope);
  };

  Skew.Resolving.Resolver.prototype.resolveParameterize = function(node, scope) {
    var self = this;
    var value = node.parameterizeValue();
    self.resolveNode(value, scope, null);

    // Resolve parameter types
    var substitutions = [];
    var count = node.children.length - 1 | 0;

    for (var i = 0, count1 = count; i < count1; ++i) {
      var child = node.children[i + 1 | 0];
      self.resolveAsParameterizedType(child, scope);
      substitutions.push(child.resolvedType);
    }

    // Check for type parameters
    var type = value.resolvedType;
    var parameters = type.parameters();

    if (parameters === null || type.isParameterized()) {
      if (type !== Skew.Type.DYNAMIC) {
        self.log.semanticErrorCannotParameterize(node.range, type);
      }

      value.resolvedType = Skew.Type.DYNAMIC;
      return;
    }

    // Check parameter count
    var expected = parameters.length;

    if (count !== expected) {
      self.log.semanticErrorParameterCount(node.internalRangeOrRange(), expected, count);
      value.resolvedType = Skew.Type.DYNAMIC;
      return;
    }

    // Make sure all parameters have types
    for (var i1 = 0, list = parameters, count2 = list.length; i1 < count2; ++i1) {
      var parameter = list[i1];
      self.initializeSymbol(parameter);
    }

    // Include the symbol for use with Node.isType
    node.resolvedType = self.cache.substitute(type, self.cache.mergeEnvironments(type.environment, self.cache.createEnvironment(parameters, substitutions), null));
    node.symbol = value.symbol;
  };

  Skew.Resolving.Resolver.prototype.resolveSuper = function(node, scope) {
    var self = this;
    var $function = scope.findEnclosingFunction();
    var symbol = $function === null ? null : $function.symbol;
    var overridden = symbol === null ? null : symbol.overloaded !== null ? symbol.overloaded.overridden : symbol.overridden;

    if (overridden === null) {
      self.log.semanticErrorBadSuper(node.range);
      return;
    }

    // Calling a static method doesn't need special handling
    if (overridden.kind === Skew.SymbolKind.FUNCTION_GLOBAL) {
      node.kind = Skew.NodeKind.NAME;
    }

    node.resolvedType = overridden.resolvedType;
    node.symbol = overridden;
    self.automaticallyCallGetter(node, scope);
  };

  Skew.Resolving.Resolver.prototype.resolveUnary = function(node, scope) {
    var self = this;
    self.resolveOperatorOverload(node, scope);
  };

  Skew.Resolving.Resolver.prototype.resolveBinary = function(node, scope) {
    var self = this;
    var kind = node.kind;
    var left = node.binaryLeft();
    var right = node.binaryRight();

    // Special-case the equality operators
    if (kind === Skew.NodeKind.EQUAL || kind === Skew.NodeKind.NOT_EQUAL) {
      if (Skew.Resolving.Resolver.needsTypeContext(left)) {
        self.resolveAsParameterizedExpression(right, scope);
        self.resolveAsParameterizedExpressionWithTypeContext(left, scope, right.resolvedType);
      }

      else if (Skew.Resolving.Resolver.needsTypeContext(right)) {
        self.resolveAsParameterizedExpression(left, scope);
        self.resolveAsParameterizedExpressionWithTypeContext(right, scope, left.resolvedType);
      }

      else {
        self.resolveAsParameterizedExpression(left, scope);
        self.resolveAsParameterizedExpression(right, scope);
      }

      // The two types must be compatible
      var commonType = self.cache.commonImplicitType(left.resolvedType, right.resolvedType);

      if (commonType !== null) {
        node.resolvedType = self.cache.boolType;
      }

      else {
        self.log.semanticErrorNoCommonType(node.range, left.resolvedType, right.resolvedType);
      }

      return;
    }

    // Special-case assignment since it's not overridable
    if (kind === Skew.NodeKind.ASSIGN) {
      self.resolveAsParameterizedExpression(left, scope);

      // Automatically call setters
      if (left.symbol !== null && left.symbol.isSetter()) {
        node.become(Skew.Node.createCall(left.replaceWithNull(), [right.replaceWithNull()]).withRange(node.range).withInternalRange(right.range));
        self.resolveAsParameterizedExpression(node, scope);
      }

      // Resolve the right side using type context from the left side
      else {
        self.resolveAsParameterizedExpressionWithConversion(right, scope, left.resolvedType);
        node.resolvedType = left.resolvedType;
        self.checkStorage(left, scope);
      }

      return;
    }

    // Special-case short-circuit logical operators since they aren't overridable
    if (kind === Skew.NodeKind.LOGICAL_AND || kind === Skew.NodeKind.LOGICAL_OR) {
      self.resolveAsParameterizedExpressionWithConversion(left, scope, self.cache.boolType);
      self.resolveAsParameterizedExpressionWithConversion(right, scope, self.cache.boolType);
      node.resolvedType = self.cache.boolType;
      return;
    }

    self.resolveOperatorOverload(node, scope);
  };

  Skew.Resolving.Resolver.prototype.resolveIndex = function(node, scope) {
    var self = this;
    self.resolveOperatorOverload(node, scope);
  };

  Skew.Resolving.Resolver.prototype.resolveOperatorOverload = function(node, scope) {
    var self = this;

    // The order of operands are reversed for the "in" operator
    var kind = node.kind;
    var reverseBinaryOrder = kind === Skew.NodeKind.IN;
    var target = node.children[reverseBinaryOrder | 0];
    var other = Skew.NodeKind.isBinary(kind) ? node.children[1 - (reverseBinaryOrder | 0) | 0] : null;

    // Allow "foo in [.FOO, .BAR]"
    if (kind === Skew.NodeKind.IN && target.kind === Skew.NodeKind.INITIALIZER_LIST && !Skew.Resolving.Resolver.needsTypeContext(other)) {
      self.resolveAsParameterizedExpression(other, scope);
      self.resolveAsParameterizedExpressionWithTypeContext(target, scope, other.resolvedType !== Skew.Type.DYNAMIC ? self.cache.createListType(other.resolvedType) : null);
    }

    // Resolve just the target since the other arguments may need type context from overload resolution
    else {
      self.resolveAsParameterizedExpression(target, scope);
    }

    // Check for a valid storage location even for overloadable operators
    if (Skew.NodeKind.isAssign(kind)) {
      self.checkStorage(target, scope);
    }

    // Can't do overload resolution on the dynamic type
    var type = target.resolvedType;

    if (type === Skew.Type.DYNAMIC) {
      self.resolveChildrenAsParameterizedExpressions(node, scope);
      return;
    }

    // Check if the operator can be overridden at all
    var info = Skew.operatorInfo[kind];

    if (info.kind !== Skew.OperatorKind.OVERRIDABLE) {
      self.log.semanticErrorUnknownMemberSymbol(node.internalRangeOrRange(), info.text, type);
      self.resolveChildrenAsParameterizedExpressions(node, scope);
      return;
    }

    // Avoid infinite expansion
    var isComparison = Skew.NodeKind.isBinaryComparison(kind);
    var isString = type === self.cache.stringType;

    if (isComparison && (isString || self.cache.isNumeric(type))) {
      self.resolveAsParameterizedExpression(other, scope);

      if (isString ? other.resolvedType === self.cache.stringType : self.cache.isNumeric(other.resolvedType)) {
        self.resolveChildrenAsParameterizedExpressions(node, scope);
        node.resolvedType = self.cache.boolType;
        return;
      }
    }

    // Auto-convert int to double when it appears as the target
    if (other !== null && type === self.cache.intType) {
      self.resolveAsParameterizedExpression(other, scope);

      if (other.resolvedType === self.cache.doubleType) {
        self.checkConversion(target, self.cache.doubleType, Skew.Resolving.ConversionKind.IMPLICIT);
        type = self.cache.doubleType;
      }
    }

    // Find the operator method
    var name = isComparison ? "<=>" : info.text;
    var symbol = self.findMember(type, name);

    if (symbol === null) {
      self.log.semanticErrorUnknownMemberSymbol(node.internalRangeOrRange(), name, type);
      self.resolveChildrenAsParameterizedExpressions(node, scope);
      return;
    }

    var symbolType = self.cache.substitute(symbol.resolvedType, type.environment);

    // Resolve the overload now so the symbol's properties can be inspected
    if (Skew.SymbolKind.isOverloadedFunction(symbol.kind)) {
      if (reverseBinaryOrder) {
        node.children.reverse();
      }

      symbolType = self.resolveOverloadedFunction(node.internalRangeOrRange(), node.children, scope, symbolType);

      if (reverseBinaryOrder) {
        node.children.reverse();
      }

      if (symbolType === null) {
        self.resolveChildrenAsParameterizedExpressions(node, scope);
        return;
      }

      symbol = symbolType.symbol;
    }

    node.symbol = symbol;
    self.checkAccess(node, node.internalRangeOrRange(), scope);

    // Don't replace the operator with a call if it's just used for type checking
    if (symbol.isImported() && !symbol.isRenamed()) {
      if (reverseBinaryOrder) {
        node.children.reverse();
      }

      if (!self.resolveFunctionCall(node, scope, symbolType)) {
        self.resolveChildrenAsParameterizedExpressions(node, scope);
      }

      if (reverseBinaryOrder) {
        node.children.reverse();
      }

      return;
    }

    // Resolve the method call
    var children = node.removeChildren();

    if (reverseBinaryOrder) {
      children.reverse();
    }

    children[0] = new Skew.Node(Skew.NodeKind.DOT).withContent(new Skew.StringContent(name)).withChildren([children[0]]).withSymbol(symbol).withRange(node.internalRangeOrRange());

    // Implement the logic for the "<=>" operator
    if (isComparison) {
      var call = new Skew.Node(Skew.NodeKind.CALL).withChildren(children).withRange(node.range);
      node.appendChild(call);
      node.appendChild(new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.IntContent(0)));
      node.resolvedType = self.cache.boolType;
      self.resolveFunctionCall(call, scope, symbolType);
      return;
    }

    // All other operators are just normal method calls
    node.kind = Skew.NodeKind.CALL;
    node.withChildren(children);
    self.resolveFunctionCall(node, scope, symbolType);
  };

  Skew.Resolving.Resolver.prototype.automaticallyCallGetter = function(node, scope) {
    var self = this;
    var symbol = node.symbol;

    if (symbol === null) {
      return;
    }

    var kind = symbol.kind;
    var parent = node.parent;

    // The check for getters is complicated by overloaded functions
    if (!symbol.isGetter() && Skew.SymbolKind.isOverloadedFunction(kind) && (!Skew.Resolving.Resolver.isCallValue(node) || parent.children.length === 1)) {
      var overloaded = symbol.asOverloadedFunctionSymbol();

      for (var i = 0, list = overloaded.symbols, count = list.length; i < count; ++i) {
        var getter = list[i];

        // Just return the first getter assuming errors for duplicate getters
        // were already logged when the overloaded symbol was initialized
        if (getter.isGetter()) {
          node.resolvedType = self.cache.substitute(getter.resolvedType, node.resolvedType.environment);
          node.symbol = getter;
          symbol = getter;
          break;
        }
      }
    }

    self.checkAccess(node, node.internalRangeOrRange(), scope);

    // Automatically wrap the getter in a call expression
    if (symbol.isGetter()) {
      var value = new Skew.Node(Skew.NodeKind.NULL);
      value.become(node);
      node.become(Skew.Node.createCall(value, []).withRange(node.range));
      self.resolveAsParameterizedExpression(node, scope);
    }

    // Forbid bare function references
    else if (node.resolvedType !== Skew.Type.DYNAMIC && Skew.SymbolKind.isFunctionOrOverloadedFunction(kind) && kind !== Skew.SymbolKind.FUNCTION_ANNOTATION && !Skew.Resolving.Resolver.isCallValue(node) && (parent === null || parent.kind !== Skew.NodeKind.PARAMETERIZE || !Skew.Resolving.Resolver.isCallValue(parent))) {
      self.log.semanticErrorMustCallFunction(node.internalRangeOrRange(), symbol.name);
      node.resolvedType = Skew.Type.DYNAMIC;
    }
  };

  Skew.Resolving.Resolver.shouldCheckForSetter = function(node) {
    return node.parent !== null && node.parent.kind === Skew.NodeKind.ASSIGN && node === node.parent.binaryLeft();
  };

  Skew.Resolving.Resolver.isVoidExpressionUsed = function(node) {
    // Check for a null parent to handle variable initializers
    var parent = node.parent;
    return parent === null || parent.kind !== Skew.NodeKind.EXPRESSION && !parent.isImplicitReturn() && (parent.kind !== Skew.NodeKind.ANNOTATION || node !== parent.annotationValue()) && (parent.kind !== Skew.NodeKind.FOR || node !== parent.forUpdate());
  };

  Skew.Resolving.Resolver.isValidVariableType = function(type) {
    return type !== Skew.Type.NULL && (type.kind !== Skew.TypeKind.SYMBOL || !Skew.SymbolKind.isFunctionOrOverloadedFunction(type.symbol.kind));
  };

  Skew.Resolving.Resolver.createSymbolReference = function(symbol) {
    return new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent(symbol.name)).withSymbol(symbol).withType(symbol.resolvedType);
  };

  Skew.Resolving.Resolver.createMemberReference = function(target, member) {
    return new Skew.Node(Skew.NodeKind.DOT).withContent(new Skew.StringContent(member.name)).withChildren([target]).withSymbol(member).withType(member.resolvedType);
  };

  Skew.Resolving.Resolver.isBaseGlobalReference = function(parent, member) {
    return parent !== null && parent.kind === Skew.SymbolKind.OBJECT_CLASS && Skew.SymbolKind.isGlobalReference(member.kind) && member.parent !== parent && member.parent.kind === Skew.SymbolKind.OBJECT_CLASS && parent.asObjectSymbol().hasBaseClass(member.parent);
  };

  Skew.Resolving.Resolver.isCallValue = function(node) {
    var parent = node.parent;
    return parent !== null && parent.kind === Skew.NodeKind.CALL && node === parent.callValue();
  };

  Skew.Resolving.Resolver.needsTypeContext = function(node) {
    return node.kind === Skew.NodeKind.DOT && node.dotTarget() === null || node.kind === Skew.NodeKind.HOOK && Skew.Resolving.Resolver.needsTypeContext(node.hookTrue()) && Skew.Resolving.Resolver.needsTypeContext(node.hookFalse()) || Skew.NodeKind.isInitializer(node.kind);
  };

  Skew.Resolving.Resolver.ensureFunctionIsOverloaded = function(symbol) {
    if (symbol.overloaded === null) {
      var overloaded = new Skew.OverloadedFunctionSymbol(Skew.Merging.overloadedKind(symbol.kind), symbol.name, [symbol]);
      overloaded.parent = symbol.parent;
      overloaded.scope = overloaded.parent.scope;
      symbol.overloaded = overloaded;
      overloaded.scope.asObjectScope().symbol.members[symbol.name] = overloaded;
    }
  };

  Skew.Resolving.ConstantResolver = function(resolver) {
    var self = this;
    Skew.Folding.ConstantLookup.call(self);
    self.map = Object.create(null);
    self.resolver = resolver;
  };

  __extends(Skew.Resolving.ConstantResolver, Skew.Folding.ConstantLookup);

  Skew.Resolving.ConstantResolver.prototype.constantForSymbol = function(symbol) {
    var self = this;

    if (symbol.id in self.map) {
      return self.map[symbol.id];
    }

    self.resolver.initializeSymbol(symbol);
    var constant = null;
    var value = symbol.value;

    if (symbol.isConst() && value !== null) {
      self.resolver.constantFolder.foldConstants(value);

      if (value.kind === Skew.NodeKind.CONSTANT) {
        constant = value.content;
      }
    }

    self.map[symbol.id] = constant;
    return constant;
  };

  Skew.ScopeKind = {
    FUNCTION: 0,
    LOCAL: 1,
    OBJECT: 2,
    VARIABLE: 3
  };

  Skew.Scope = function(parent) {
    var self = this;
    self.parent = parent;
    self.used = null;
  };

  Skew.Scope.prototype.asObjectScope = function() {
    var self = this;
    assert(self.kind() === Skew.ScopeKind.OBJECT);
    return self;
  };

  Skew.Scope.prototype.asFunctionScope = function() {
    var self = this;
    assert(self.kind() === Skew.ScopeKind.FUNCTION);
    return self;
  };

  Skew.Scope.prototype.asVariableScope = function() {
    var self = this;
    assert(self.kind() === Skew.ScopeKind.VARIABLE);
    return self;
  };

  Skew.Scope.prototype.asLocalScope = function() {
    var self = this;
    assert(self.kind() === Skew.ScopeKind.LOCAL);
    return self;
  };

  Skew.Scope.prototype.findEnclosingFunctionOrLambda = function() {
    var self = this;
    var scope = self;

    while (scope !== null) {
      if (scope.kind() === Skew.ScopeKind.FUNCTION) {
        return scope.asFunctionScope();
      }

      scope = scope.parent;
    }

    return null;
  };

  Skew.Scope.prototype.findEnclosingFunction = function() {
    var self = this;
    var scope = self;

    while (scope !== null) {
      if (scope.kind() === Skew.ScopeKind.FUNCTION && scope.asFunctionScope().symbol.kind !== Skew.SymbolKind.FUNCTION_LOCAL) {
        return scope.asFunctionScope();
      }

      scope = scope.parent;
    }

    return null;
  };

  Skew.Scope.prototype.findEnclosingLoop = function() {
    var self = this;
    var scope = self;

    while (scope !== null && scope.kind() === Skew.ScopeKind.LOCAL) {
      if (scope.asLocalScope().type === Skew.LocalType.LOOP) {
        return scope.asLocalScope();
      }

      scope = scope.parent;
    }

    return null;
  };

  Skew.Scope.prototype.generateName = function(prefix) {
    var self = this;
    var count = 0;
    var name = prefix;

    while (true) {
      if (self.find(name) === null && (self.used === null || !(name in self.used))) {
        self.reserveName(name, null);
        return name;
      }

      ++count;
      name = prefix + count.toString();
    }

    return prefix;
  };

  Skew.Scope.prototype.reserveName = function(name, symbol) {
    var self = this;

    if (self.used === null) {
      self.used = Object.create(null);
    }

    if (!(name in self.used)) {
      self.used[name] = symbol;
    }
  };

  Skew.ObjectScope = function(parent, symbol) {
    var self = this;
    Skew.Scope.call(self, parent);
    self.symbol = symbol;
  };

  __extends(Skew.ObjectScope, Skew.Scope);

  Skew.ObjectScope.prototype.kind = function() {
    var self = this;
    return Skew.ScopeKind.OBJECT;
  };

  Skew.ObjectScope.prototype.find = function(name) {
    var self = this;
    var check = self.symbol;

    while (check !== null) {
      var result = in_StringMap.get(check.members, name, null);

      if (result !== null) {
        return result;
      }

      check = check.baseClass;
    }

    return self.parent !== null ? self.parent.find(name) : null;
  };

  Skew.FunctionScope = function(parent, symbol) {
    var self = this;
    Skew.Scope.call(self, parent);
    self.symbol = symbol;
    self.parameters = Object.create(null);
  };

  __extends(Skew.FunctionScope, Skew.Scope);

  Skew.FunctionScope.prototype.kind = function() {
    var self = this;
    return Skew.ScopeKind.FUNCTION;
  };

  Skew.FunctionScope.prototype.find = function(name) {
    var self = this;
    var result = in_StringMap.get(self.parameters, name, null);
    return result !== null ? result : self.parent !== null ? self.parent.find(name) : null;
  };

  Skew.VariableScope = function(parent, symbol) {
    var self = this;
    Skew.Scope.call(self, parent);
    self.symbol = symbol;
  };

  __extends(Skew.VariableScope, Skew.Scope);

  Skew.VariableScope.prototype.kind = function() {
    var self = this;
    return Skew.ScopeKind.VARIABLE;
  };

  Skew.VariableScope.prototype.find = function(name) {
    var self = this;
    return self.parent !== null ? self.parent.find(name) : null;
  };

  Skew.LocalType = {
    LOOP: 0,
    NORMAL: 1
  };

  Skew.LocalScope = function(parent, type) {
    var self = this;
    Skew.Scope.call(self, parent);
    self.locals = Object.create(null);
    self.type = type;
  };

  __extends(Skew.LocalScope, Skew.Scope);

  Skew.LocalScope.prototype.kind = function() {
    var self = this;
    return Skew.ScopeKind.LOCAL;
  };

  Skew.LocalScope.prototype.find = function(name) {
    var self = this;
    var result = in_StringMap.get(self.locals, name, null);
    return result !== null ? result : self.parent !== null ? self.parent.find(name) : null;
  };

  Skew.LocalScope.prototype.define = function(symbol, log) {
    var self = this;
    symbol.scope = self;

    // Check for duplicates
    var other = in_StringMap.get(self.locals, symbol.name, null);

    if (other !== null) {
      log.semanticErrorDuplicateSymbol(symbol.range, symbol.name, other.range);
      return;
    }

    // Check for shadowing
    var scope = self.parent;

    while (scope.kind() === Skew.ScopeKind.LOCAL) {
      var local = in_StringMap.get(scope.asLocalScope().locals, symbol.name, null);

      if (local !== null) {
        log.semanticErrorShadowedSymbol(symbol.range, symbol.name, local.range);
        return;
      }

      scope = scope.parent;
    }

    scope.reserveName(symbol.name, symbol);
    self.locals[symbol.name] = symbol;
  };

  Skew.ShakingMode = {
    USE_TYPES: 0,
    IGNORE_TYPES: 1
  };

  // This stores a mapping from every symbol to its immediate dependencies and
  // uses that to provide a mapping from a subset of symbols to their complete
  // dependencies. This is useful for dead code elimination.
  Skew.UsageGraph = function(global, mode) {
    var self = this;
    self.context = null;
    self.currentUsages = null;
    self.overridesForSymbol = Object.create(null);
    self.usages = Object.create(null);
    self.mode = mode;
    self.visitObject(global);
    self.changeContext(null);
  };

  Skew.UsageGraph.prototype.usagesForSymbols = function(symbols) {
    var self = this;
    var combinedUsages = Object.create(null);
    var stack = [];
    in_List.append2(stack, symbols);

    // Iterate until a fixed point is reached
    while (!(stack.length === 0)) {
      var overridesToCheck = [];

      // Follow immediate dependency links
      while (!(stack.length === 0)) {
        var symbol = stack.pop();

        if (!(symbol.id in combinedUsages)) {
          combinedUsages[symbol.id] = symbol;
          var symbolUsages = in_IntMap.get(self.usages, symbol.id, null);

          if (symbolUsages !== null) {
            in_List.append2(stack, symbolUsages);
          }

          if (Skew.SymbolKind.isFunction(symbol.kind)) {
            var overridden = symbol.asFunctionSymbol().overridden;
            var overrides = in_IntMap.get(self.overridesForSymbol, symbol.id, null);

            // Automatically include all overridden functions in case the use
            // of this type is polymorphic, which is a conservative estimate
            if (overridden !== null) {
              stack.push(overridden);
            }

            // Check function overrides after everything settles
            if (overrides !== null) {
              in_List.append2(overridesToCheck, overrides);
            }
          }
        }
      }

      // Add overrides for all types that are currently included. Types that
      // aren't included shouldn't ever be constructed and so encountering one
      // should be impossible.
      for (var i = 0, list = overridesToCheck, count = list.length; i < count; ++i) {
        var override = list[i];

        if (override.parent.id in combinedUsages) {
          stack.push(override);
        }
      }
    }

    return combinedUsages;
  };

  Skew.UsageGraph.prototype.changeContext = function(symbol) {
    var self = this;

    if (self.context !== null) {
      self.usages[self.context.id] = in_IntMap.values(self.currentUsages);
    }

    self.currentUsages = Object.create(null);

    if (symbol !== null) {
      self.currentUsages[symbol.id] = symbol;
    }

    self.context = symbol;
  };

  Skew.UsageGraph.prototype.recordUsage = function(symbol) {
    var self = this;

    if (!Skew.SymbolKind.isLocal(symbol.kind)) {
      self.currentUsages[symbol.id] = symbol;
    }
  };

  Skew.UsageGraph.prototype.visitObject = function(symbol) {
    var self = this;

    for (var i = 0, list = symbol.objects, count = list.length; i < count; ++i) {
      var object = list[i];
      self.changeContext(object);
      self.recordUsage(symbol);

      if (object.baseClass !== null) {
        self.recordUsage(object.baseClass);
      }

      self.visitObject(object);
    }

    for (var i1 = 0, list1 = symbol.functions, count1 = list1.length; i1 < count1; ++i1) {
      var $function = list1[i1];
      self.changeContext($function);
      self.recordUsage(symbol);
      self.visitFunction($function);

      // Remember which functions are overridden for later
      if ($function.overridden !== null) {
        var overrides = in_IntMap.get(self.overridesForSymbol, $function.overridden.id, null);

        if (overrides === null) {
          overrides = [];
          self.overridesForSymbol[$function.overridden.id] = overrides;
        }

        overrides.push($function);
      }
    }

    for (var i2 = 0, list2 = symbol.variables, count2 = list2.length; i2 < count2; ++i2) {
      var variable = list2[i2];
      self.changeContext(variable);
      self.recordUsage(symbol);
      self.visitVariable(variable);
    }
  };

  Skew.UsageGraph.prototype.visitFunction = function(symbol) {
    var self = this;

    for (var i = 0, list = symbol.$arguments, count = list.length; i < count; ++i) {
      var argument = list[i];
      self.visitVariable(argument);
    }

    self.visitType(symbol.resolvedType.returnType);
    self.visitNode(symbol.block);
  };

  Skew.UsageGraph.prototype.visitVariable = function(symbol) {
    var self = this;
    self.visitType(symbol.resolvedType);
    self.visitNode(symbol.value);
  };

  Skew.UsageGraph.prototype.visitNode = function(node) {
    var self = this;

    if (node === null) {
      return;
    }

    var children = node.children;

    if (children !== null) {
      for (var i = 0, list = children, count = list.length; i < count; ++i) {
        var child = list[i];
        self.visitNode(child);
      }
    }

    if (node.symbol !== null) {
      self.recordUsage(node.symbol);
    }

    switch (node.kind) {
      case Skew.NodeKind.LAMBDA: {
        var $function = node.symbol.asFunctionSymbol();

        for (var i1 = 0, list1 = $function.$arguments, count1 = list1.length; i1 < count1; ++i1) {
          var argument = list1[i1];
          self.visitVariable(argument);
        }

        self.visitType($function.resolvedType.returnType);
        break;
      }

      case Skew.NodeKind.VAR: {
        self.visitType(node.symbol.asVariableSymbol().resolvedType);
        break;
      }
    }
  };

  Skew.UsageGraph.prototype.visitType = function(type) {
    var self = this;

    if (self.mode === Skew.ShakingMode.USE_TYPES && type !== null && type.symbol !== null) {
      self.recordUsage(type.symbol);

      // This should be a tree too, so infinite loops should not happen
      if (type.isParameterized()) {
        for (var i = 0, list = type.substitutions, count = list.length; i < count; ++i) {
          var substitution = list[i];
          self.visitType(substitution);
        }
      }
    }
  };

  Skew.Shaking = {};

  Skew.Shaking.collectImportedOrExportedSymbols = function(symbol, symbols, entryPoint) {
    for (var i = 0, list = symbol.objects, count = list.length; i < count; ++i) {
      var object = list[i];
      Skew.Shaking.collectImportedOrExportedSymbols(object, symbols, entryPoint);

      if (object.isImportedOrExported()) {
        symbols.push(object);
      }
    }

    for (var i1 = 0, list1 = symbol.functions, count1 = list1.length; i1 < count1; ++i1) {
      var $function = list1[i1];

      if ($function.isImportedOrExported() || $function === entryPoint) {
        symbols.push($function);
      }
    }

    for (var i2 = 0, list2 = symbol.variables, count2 = list2.length; i2 < count2; ++i2) {
      var variable = list2[i2];

      if (variable.isImportedOrExported()) {
        symbols.push(variable);
      }
    }
  };

  Skew.Shaking.removeUnusedSymbols = function(symbol, usages) {
    in_List.removeIf(symbol.objects, function(object) {
      return !(object.id in usages);
    });
    in_List.removeIf(symbol.functions, function($function) {
      return !($function.id in usages);
    });
    in_List.removeIf(symbol.variables, function(variable) {
      return !(variable.id in usages);
    });

    for (var i = 0, list = symbol.objects, count = list.length; i < count; ++i) {
      var object = list[i];
      Skew.Shaking.removeUnusedSymbols(object, usages);
    }
  };

  Skew.TypeKind = {
    LAMBDA: 0,
    SPECIAL: 1,
    SYMBOL: 2
  };

  Skew.Type = function(kind, symbol) {
    var self = this;
    self.id = Skew.Type.createID();
    self.kind = kind;
    self.symbol = symbol;
    self.environment = null;
    self.substitutions = null;
    self.argumentTypes = null;
    self.returnType = null;
    self.substitutionCache = null;
  };

  Skew.Type.prototype.parameters = function() {
    var self = this;
    return self.symbol === null ? null : Skew.SymbolKind.isObject(self.symbol.kind) ? self.symbol.asObjectSymbol().parameters : Skew.SymbolKind.isFunction(self.symbol.kind) ? self.symbol.asFunctionSymbol().parameters : null;
  };

  Skew.Type.prototype.isParameterized = function() {
    var self = this;
    return self.substitutions !== null;
  };

  Skew.Type.prototype.isClass = function() {
    var self = this;
    return self.symbol !== null && self.symbol.kind === Skew.SymbolKind.OBJECT_CLASS;
  };

  Skew.Type.prototype.isEnum = function() {
    var self = this;
    return self.symbol !== null && self.symbol.kind === Skew.SymbolKind.OBJECT_ENUM;
  };

  // Type parameters are not guaranteed to be nullable since generics are
  // implemented through type erasure and the substituted type may be "int"
  Skew.Type.prototype.isReference = function() {
    var self = this;
    return self.symbol === null || !self.symbol.isValueType() && !Skew.SymbolKind.isParameter(self.symbol.kind);
  };

  Skew.Type.prototype.toString = function() {
    var self = this;

    if (self.kind === Skew.TypeKind.SYMBOL) {
      if (self.isParameterized()) {
        var name = self.symbol.name + "<";

        for (var i = 0, count = self.substitutions.length; i < count; ++i) {
          if (i !== 0) {
            name += ", ";
          }

          name += self.substitutions[i].toString();
        }

        return name + ">";
      }

      return self.symbol.name;
    }

    if (self.kind === Skew.TypeKind.LAMBDA) {
      var result = "fn(";

      for (var i1 = 0, count1 = self.argumentTypes.length; i1 < count1; ++i1) {
        if (i1 !== 0) {
          result += ", ";
        }

        result += self.argumentTypes[i1].toString();
      }

      return result + (self.returnType !== null ? ") " + self.returnType.toString() : ")");
    }

    return self === Skew.Type.DYNAMIC ? "dynamic" : "null";
  };

  Skew.Type.prototype.baseClass = function() {
    var self = this;

    if (self.isClass()) {
      var base = self.symbol.asObjectSymbol().base;

      if (base !== null) {
        return base.resolvedType;
      }
    }

    return null;
  };

  Skew.Type.prototype.hasBaseType = function(type) {
    var self = this;
    var base = self.baseClass();
    return base !== null && (base === type || base.hasBaseType(type));
  };

  Skew.Type.initialize = function() {
    if (Skew.Type.DYNAMIC === null) {
      Skew.Type.DYNAMIC = new Skew.Type(Skew.TypeKind.SPECIAL, null);
    }

    if (Skew.Type.NULL === null) {
      Skew.Type.NULL = new Skew.Type(Skew.TypeKind.SPECIAL, null);
    }
  };

  Skew.Type.createID = function() {
    ++Skew.Type.nextID;
    return Skew.Type.nextID;
  };

  Skew.Environment = function(parameters, substitutions) {
    var self = this;
    self.id = Skew.Environment.createID();
    self.parameters = parameters;
    self.substitutions = substitutions;
    self.mergeCache = null;
  };

  Skew.Environment.createID = function() {
    ++Skew.Environment.nextID;
    return Skew.Environment.nextID;
  };

  Skew.TypeCache = function() {
    var self = this;
    self.boolType = null;
    self.doubleType = null;
    self.intMapType = null;
    self.intType = null;
    self.listType = null;
    self.stringMapType = null;
    self.stringType = null;
    self.entryPointSymbol = null;
    self.environments = Object.create(null);
    self.lambdaTypes = Object.create(null);
  };

  Skew.TypeCache.prototype.loadGlobals = function(log, global) {
    var self = this;
    Skew.Type.initialize();
    self.boolType = Skew.TypeCache.loadGlobalClass(log, global, "bool", Skew.Symbol.IS_VALUE_TYPE);
    self.doubleType = Skew.TypeCache.loadGlobalClass(log, global, "double", Skew.Symbol.IS_VALUE_TYPE);
    self.intMapType = Skew.TypeCache.loadGlobalClass(log, global, "IntMap", 0);
    self.intType = Skew.TypeCache.loadGlobalClass(log, global, "int", Skew.Symbol.IS_VALUE_TYPE);
    self.listType = Skew.TypeCache.loadGlobalClass(log, global, "List", 0);
    self.stringMapType = Skew.TypeCache.loadGlobalClass(log, global, "StringMap", 0);
    self.stringType = Skew.TypeCache.loadGlobalClass(log, global, "string", Skew.Symbol.IS_VALUE_TYPE);
  };

  Skew.TypeCache.prototype.isInteger = function(type) {
    var self = this;
    return type === self.intType || type.isEnum();
  };

  Skew.TypeCache.prototype.isNumeric = function(type) {
    var self = this;
    return self.isInteger(type) || type === self.doubleType;
  };

  Skew.TypeCache.prototype.isList = function(type) {
    var self = this;
    return type.symbol === self.listType.symbol;
  };

  Skew.TypeCache.prototype.canImplicitlyConvert = function(from, to) {
    var self = this;

    if (from === to) {
      return true;
    }

    if (from === Skew.Type.DYNAMIC || to === Skew.Type.DYNAMIC) {
      return true;
    }

    if (from === Skew.Type.NULL && to.isReference()) {
      return true;
    }

    if (from === self.intType && to === self.doubleType) {
      return true;
    }

    if (from.hasBaseType(to)) {
      return true;
    }

    if (from.isEnum() && !to.isEnum() && self.isNumeric(to)) {
      return true;
    }

    return false;
  };

  Skew.TypeCache.prototype.canExplicitlyConvert = function(from, to) {
    var self = this;

    if (self.canImplicitlyConvert(from, to)) {
      return true;
    }

    if (self.canCastToNumeric(from) && self.canCastToNumeric(to)) {
      return true;
    }

    if (to.hasBaseType(from)) {
      return true;
    }

    if (to.isEnum() && self.isNumeric(from)) {
      return true;
    }

    return false;
  };

  Skew.TypeCache.prototype.commonImplicitType = function(left, right) {
    var self = this;

    // Short-circuit early for identical types
    if (left === right) {
      return left;
    }

    // Dynamic is a hole in the type system
    if (left === Skew.Type.DYNAMIC || right === Skew.Type.DYNAMIC) {
      return Skew.Type.DYNAMIC;
    }

    // Check implicit conversions
    if (self.canImplicitlyConvert(left, right)) {
      return right;
    }

    if (self.canImplicitlyConvert(right, left)) {
      return left;
    }

    // Implement common implicit types for numeric types
    if (self.isNumeric(left) && self.isNumeric(right)) {
      return self.isInteger(left) && self.isInteger(right) ? self.intType : self.doubleType;
    }

    // Check for a common base class
    if (left.isClass() && right.isClass()) {
      return Skew.TypeCache.commonBaseClass(left, right);
    }

    return null;
  };

  Skew.TypeCache.prototype.createListType = function(itemType) {
    var self = this;
    return self.substitute(self.listType, self.createEnvironment(self.listType.parameters(), [itemType]));
  };

  Skew.TypeCache.prototype.createIntMapType = function(valueType) {
    var self = this;
    return self.substitute(self.intMapType, self.createEnvironment(self.intMapType.parameters(), [valueType]));
  };

  Skew.TypeCache.prototype.createStringMapType = function(valueType) {
    var self = this;
    return self.substitute(self.stringMapType, self.createEnvironment(self.stringMapType.parameters(), [valueType]));
  };

  Skew.TypeCache.prototype.createEnvironment = function(parameters, substitutions) {
    var self = this;
    assert(parameters.length === substitutions.length);

    // Hash the inputs
    var hash = Skew.TypeCache.hashTypes(Skew.TypeCache.hashParameters(parameters), substitutions);
    var bucket = in_IntMap.get(self.environments, hash, null);

    // Check existing environments in the bucket for a match
    if (bucket !== null) {
      for (var i = 0, list = bucket, count = list.length; i < count; ++i) {
        var existing = list[i];

        if (in_List.isEqualTo(parameters, existing.parameters) && in_List.isEqualTo(substitutions, existing.substitutions)) {
          return existing;
        }
      }
    }

    // Make a new bucket
    else {
      bucket = [];
      self.environments[hash] = bucket;
    }

    // Make a new environment
    var environment = new Skew.Environment(parameters, substitutions);
    bucket.push(environment);
    return environment;
  };

  Skew.TypeCache.prototype.createLambdaType = function(argumentTypes, returnType) {
    var self = this;
    var hash = Skew.TypeCache.hashTypes(returnType !== null ? returnType.id : -1, argumentTypes);
    var bucket = in_IntMap.get(self.lambdaTypes, hash, null);

    // Check existing types in the bucket for a match
    if (bucket !== null) {
      for (var i = 0, list = bucket, count = list.length; i < count; ++i) {
        var existing = list[i];

        if (in_List.isEqualTo(argumentTypes, existing.argumentTypes) && returnType === existing.returnType) {
          return existing;
        }
      }
    }

    // Make a new bucket
    else {
      bucket = [];
      self.lambdaTypes[hash] = bucket;
    }

    // Make a new lambda type
    var type = new Skew.Type(Skew.TypeKind.LAMBDA, null);
    type.argumentTypes = argumentTypes;
    type.returnType = returnType;
    bucket.push(type);
    return type;
  };

  Skew.TypeCache.prototype.mergeEnvironments = function(a, b, restrictions) {
    var self = this;

    if (a === null) {
      return b;
    }

    if (b === null) {
      return a;
    }

    var parameters = a.parameters.slice();
    var substitutions = self.substituteAll(a.substitutions, b);

    for (var i = 0, count = b.parameters.length; i < count; ++i) {
      var parameter = b.parameters[i];
      var substitution = b.substitutions[i];

      if (!(parameters.indexOf(parameter) !== -1) && (restrictions === null || restrictions.indexOf(parameter) !== -1)) {
        parameters.push(parameter);
        substitutions.push(substitution);
      }
    }

    return self.createEnvironment(parameters, substitutions);
  };

  Skew.TypeCache.prototype.parameterize = function(type) {
    var self = this;
    var parameters = type.parameters();

    if (parameters === null) {
      return type;
    }

    assert(!type.isParameterized());
    var substitutions = [];

    for (var i = 0, list = parameters, count = list.length; i < count; ++i) {
      var parameter = list[i];
      substitutions.push(parameter.resolvedType);
    }

    return self.substitute(type, self.createEnvironment(parameters, substitutions));
  };

  Skew.TypeCache.prototype.substituteAll = function(types, environment) {
    var self = this;
    var substitutions = [];

    for (var i = 0, list = types, count = list.length; i < count; ++i) {
      var type = list[i];
      substitutions.push(self.substitute(type, environment));
    }

    return substitutions;
  };

  Skew.TypeCache.prototype.substitute = function(type, environment) {
    var self = this;
    var existing = type.environment;

    if (environment === null || environment === existing) {
      return type;
    }

    // Merge the type environments (this matters for nested generics). For
    // object types, limit the parameters in the environment to just those
    // on this type and the base type.
    var parameters = type.parameters();

    if (existing !== null) {
      environment = self.mergeEnvironments(existing, environment, type.kind === Skew.TypeKind.SYMBOL && Skew.SymbolKind.isFunctionOrOverloadedFunction(type.symbol.kind) ? null : parameters);
    }

    // Check to see if this has been computed before
    var rootType = type.kind === Skew.TypeKind.SYMBOL ? type.symbol.resolvedType : type;

    if (rootType.substitutionCache === null) {
      rootType.substitutionCache = Object.create(null);
    }

    var substituted = in_IntMap.get(rootType.substitutionCache, environment.id, null);

    if (substituted !== null) {
      return substituted;
    }

    substituted = type;

    if (type.kind === Skew.TypeKind.LAMBDA) {
      var argumentTypes = [];
      var returnType = null;

      // Substitute function arguments
      for (var i = 0, list = type.argumentTypes, count = list.length; i < count; ++i) {
        var argumentType = list[i];
        argumentTypes.push(self.substitute(argumentType, environment));
      }

      // Substitute return type
      if (type.returnType !== null) {
        returnType = self.substitute(type.returnType, environment);
      }

      substituted = self.createLambdaType(argumentTypes, returnType);
    }

    else if (type.kind === Skew.TypeKind.SYMBOL) {
      var symbol = type.symbol;

      // Parameters just need simple substitution
      if (Skew.SymbolKind.isParameter(symbol.kind)) {
        var index = environment.parameters.indexOf(symbol.asParameterSymbol());

        if (index !== -1) {
          substituted = environment.substitutions[index];
        }
      }

      // Symbols with type parameters are more complicated
      // Overloaded functions are also included even though they don't have
      // type parameters because the type environment needs to be bundled
      // for later substitution into individual matched overloads
      else if (parameters !== null || Skew.SymbolKind.isFunctionOrOverloadedFunction(symbol.kind)) {
        substituted = new Skew.Type(Skew.TypeKind.SYMBOL, symbol);
        substituted.environment = environment;

        // Generate type substitutions
        if (parameters !== null) {
          var found = true;

          for (var i1 = 0, list1 = parameters, count1 = list1.length; i1 < count1; ++i1) {
            var parameter = list1[i1];
            found = environment.parameters.indexOf(parameter) !== -1;

            if (!found) {
              break;
            }
          }

          if (found) {
            substituted.substitutions = [];

            for (var i2 = 0, list2 = parameters, count2 = list2.length; i2 < count2; ++i2) {
              var parameter1 = list2[i2];
              substituted.substitutions.push(self.substitute(parameter1.resolvedType, environment));
            }
          }
        }

        // Substitute function arguments
        if (type.argumentTypes !== null) {
          substituted.argumentTypes = [];

          for (var i3 = 0, list3 = type.argumentTypes, count3 = list3.length; i3 < count3; ++i3) {
            var argumentType1 = list3[i3];
            substituted.argumentTypes.push(self.substitute(argumentType1, environment));
          }
        }

        // Substitute return type
        if (type.returnType !== null) {
          substituted.returnType = self.substitute(type.returnType, environment);
        }
      }
    }

    rootType.substitutionCache[environment.id] = substituted;
    return substituted;
  };

  Skew.TypeCache.prototype.canCastToNumeric = function(type) {
    var self = this;
    return type === self.intType || type === self.doubleType || type === self.boolType;
  };

  Skew.TypeCache.loadGlobalClass = function(log, global, name, flags) {
    var symbol = in_StringMap.get(global.members, name, null);
    assert(symbol !== null);
    assert(symbol.kind === Skew.SymbolKind.OBJECT_CLASS);
    var type = new Skew.Type(Skew.TypeKind.SYMBOL, symbol.asObjectSymbol());
    symbol.resolvedType = type;
    symbol.flags |= flags;
    return type;
  };

  Skew.TypeCache.hashParameters = function(parameters) {
    var hash = 0;

    for (var i = 0, list = parameters, count = list.length; i < count; ++i) {
      var parameter = list[i];
      hash = Skew.hashCombine(hash, parameter.id);
    }

    return hash;
  };

  Skew.TypeCache.hashTypes = function(hash, types) {
    for (var i = 0, list = types, count = list.length; i < count; ++i) {
      var type = list[i];
      hash = Skew.hashCombine(hash, type.id);
    }

    return hash;
  };

  Skew.TypeCache.commonBaseClass = function(left, right) {
    var a = left;

    while (a !== null) {
      var b = right;

      while (b !== null) {
        if (a === b) {
          return a;
        }

        b = b.baseClass();
      }

      a = a.baseClass();
    }

    return null;
  };

  Skew.Option = {
    DEFINE: 0,
    FOLD_CONSTANTS: 1,
    GLOBALIZE_FUNCTIONS: 2,
    HELP: 3,
    INLINE_FUNCTIONS: 4,
    JS_MANGLE: 5,
    JS_MINIFY: 6,
    MESSAGE_LIMIT: 7,
    OUTPUT_DIRECTORY: 8,
    OUTPUT_FILE: 9,
    RELEASE: 10
  };

  Skew.Options = {};

  Skew.Options.Type = {
    BOOL: 0,
    INT: 1,
    STRING: 2,
    STRING_LIST: 3
  };

  Skew.Options.Data = function(parser, type, option, name, description) {
    var self = this;
    self.parser = parser;
    self.type = type;
    self.option = option;
    self.name = name;
    self.description = description;
  };

  Skew.Options.Data.prototype.nameText = function() {
    var self = this;
    return self.name + (self.type === Skew.Options.Type.BOOL ? "" : self.type === Skew.Options.Type.STRING_LIST ? ":___" : "=___");
  };

  Skew.Options.Data.prototype.aliases = function(names) {
    var self = this;

    for (var i = 0, list = names, count = list.length; i < count; ++i) {
      var name = list[i];
      self.parser.map[name] = self;
    }

    return self;
  };

  Skew.Options.Parser = function() {
    var self = this;
    self.options = [];
    self.map = Object.create(null);
    self.optionalArguments = Object.create(null);
    self.normalArguments = [];
    self.source = null;
  };

  Skew.Options.Parser.prototype.define = function(type, option, name, description) {
    var self = this;
    var data = new Skew.Options.Data(self, type, option, name, description);
    self.map[name] = data;
    self.options.push(data);
    return data;
  };

  Skew.Options.Parser.prototype.nodeForOption = function(option) {
    var self = this;
    return in_IntMap.get(self.optionalArguments, option, null);
  };

  Skew.Options.Parser.prototype.boolForOption = function(option, defaultValue) {
    var self = this;
    var node = self.nodeForOption(option);
    return node !== null ? node.content.asBool() : defaultValue;
  };

  Skew.Options.Parser.prototype.intForOption = function(option, defaultValue) {
    var self = this;
    var node = self.nodeForOption(option);
    return node !== null ? node.content.asInt() : defaultValue;
  };

  Skew.Options.Parser.prototype.rangeForOption = function(option) {
    var self = this;
    var node = self.nodeForOption(option);
    return node !== null ? node.range : null;
  };

  Skew.Options.Parser.prototype.rangeListForOption = function(option) {
    var self = this;
    var node = self.nodeForOption(option);
    var ranges = [];

    if (node !== null) {
      for (var i = 0, list = node.children, count = list.length; i < count; ++i) {
        var child = list[i];
        ranges.push(child.range);
      }
    }

    return ranges;
  };

  Skew.Options.Parser.prototype.parse = function(log, $arguments) {
    var self = this;
    self.source = new Skew.Source("<arguments>", "");
    var ranges = [];

    // Create a source for the arguments to work with the log system. The
    // trailing space is needed to be able to point to the character after
    // the last argument without wrapping onto the next line.
    for (var i1 = 0, list = $arguments, count = list.length; i1 < count; ++i1) {
      var argument = list[i1];
      var needsQuotes = argument.indexOf(" ") !== -1;
      var start = self.source.contents.length + (needsQuotes | 0) | 0;
      ranges.push(new Skew.Range(self.source, start, start + argument.length | 0));
      self.source.contents += needsQuotes ? "'" + argument + "' " : argument + " ";
    }

    // Parse each argument
    for (var i = 0, count1 = $arguments.length; i < count1; ++i) {
      var argument1 = $arguments[i];
      var range = ranges[i];

      // Track all normal arguments separately
      if (argument1 === "" || argument1.charCodeAt(0) !== 45 && !(argument1 in self.map)) {
        self.normalArguments.push(range);
        continue;
      }

      // Parse a flag
      var equals = argument1.indexOf("=");
      var colon = argument1.indexOf(":");
      var separator = equals >= 0 && (colon < 0 || equals < colon) ? equals : colon;
      var name = separator >= 0 ? argument1.slice(0, separator) : argument1;
      var data = in_StringMap.get(self.map, name, null);

      // Check that the flag exists
      if (data === null) {
        log.commandLineErrorBadFlag(range.fromStart(name.length), name);
        continue;
      }

      // Validate the flag data
      var text = argument1.slice(separator + 1 | 0);
      var separatorRange = separator < 0 ? null : range.slice(separator, separator + 1 | 0);
      var textRange = range.fromEnd(text.length);

      switch (data.type) {
        case Skew.Options.Type.BOOL: {
          if (separator < 0) {
            text = "true";
          }

          else if (argument1.charCodeAt(separator) !== 61) {
            log.commandLineErrorExpectedToken(separatorRange, "=", argument1[separator], argument1);
            continue;
          }

          else if (text !== "true" && text !== "false") {
            log.commandLineErrorNonBooleanValue(textRange, text, argument1);
            continue;
          }

          if (data.option in self.optionalArguments) {
            log.commandLineWarningDuplicateFlagValue(textRange, name, self.optionalArguments[data.option].range);
          }

          self.optionalArguments[data.option] = new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.BoolContent(text === "true")).withRange(textRange);
          break;
        }

        case Skew.Options.Type.INT: {
          if (separator < 0) {
            log.commandLineErrorMissingValue(textRange, data.nameText());
          }

          else if (argument1.charCodeAt(separator) !== 61) {
            log.commandLineErrorExpectedToken(separatorRange, "=", argument1[separator], argument1);
          }

          else {
            var box = Skew.Parsing.parseIntLiteral(text);

            if (box === null) {
              log.commandLineErrorNonIntegerValue(textRange, text, argument1);
            }

            else {
              if (data.option in self.optionalArguments) {
                log.commandLineWarningDuplicateFlagValue(textRange, name, self.optionalArguments[data.option].range);
              }

              self.optionalArguments[data.option] = new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.IntContent(box.value)).withRange(textRange);
            }
          }
          break;
        }

        case Skew.Options.Type.STRING: {
          if (separator < 0) {
            log.commandLineErrorMissingValue(textRange, data.nameText());
          }

          else if (argument1.charCodeAt(separator) !== 61) {
            log.commandLineErrorExpectedToken(separatorRange, "=", argument1[separator], argument1);
          }

          else {
            if (data.option in self.optionalArguments) {
              log.commandLineWarningDuplicateFlagValue(textRange, name, self.optionalArguments[data.option].range);
            }

            self.optionalArguments[data.option] = new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.StringContent(text)).withRange(textRange);
          }
          break;
        }

        case Skew.Options.Type.STRING_LIST: {
          if (separator < 0) {
            log.commandLineErrorMissingValue(textRange, data.nameText());
          }

          else if (argument1.charCodeAt(separator) !== 58) {
            log.commandLineErrorExpectedToken(separatorRange, ":", argument1[separator], argument1);
          }

          else {
            var node;

            if (data.option in self.optionalArguments) {
              node = self.optionalArguments[data.option];
            }

            else {
              node = Skew.Node.createInitializer(Skew.NodeKind.INITIALIZER_LIST, []);
              self.optionalArguments[data.option] = node;
            }

            node.appendChild(new Skew.Node(Skew.NodeKind.CONSTANT).withContent(new Skew.StringContent(text)).withRange(textRange));
          }
          break;
        }
      }
    }
  };

  Skew.Options.Parser.prototype.usageText = function(wrapWidth) {
    var self = this;
    var text = "";
    var columnWidth = 0;

    // Figure out the column width
    for (var i = 0, list = self.options, count = list.length; i < count; ++i) {
      var option = list[i];
      var width = option.nameText().length + 4 | 0;

      if (columnWidth < width) {
        columnWidth = width;
      }
    }

    // Format the options
    var columnText = in_string.repeat(" ", columnWidth);

    for (var i2 = 0, list2 = self.options, count2 = list2.length; i2 < count2; ++i2) {
      var option1 = list2[i2];
      var nameText = option1.nameText();
      var isFirst = true;
      text += "\n  " + nameText + in_string.repeat(" ", (columnWidth - nameText.length | 0) - 2 | 0);

      for (var i1 = 0, list1 = Skew.PrettyPrint.wrapWords(option1.description, wrapWidth - columnWidth | 0), count1 = list1.length; i1 < count1; ++i1) {
        var line = list1[i1];
        text += (isFirst ? "" : columnText) + line + "\n";
        isFirst = false;
      }
    }

    return text + "\n";
  };

  var Unicode = {};

  Unicode.StringIterator = function() {
    var self = this;
    self.value = "";
    self.index = 0;
    self.stop = 0;
  };

  Unicode.StringIterator.prototype.reset = function(text, start) {
    var self = this;
    self.value = text;
    self.index = start;
    self.stop = text.length;
    return self;
  };

  Unicode.StringIterator.prototype.countCodePointsUntil = function(stop) {
    var self = this;
    var count = 0;

    while (self.index < stop && self.nextCodePoint() >= 0) {
      ++count;
    }

    return count;
  };

  Unicode.StringIterator.prototype.nextCodePoint = function() {
    var self = this;

    if (self.index >= self.stop) {
      return -1;
    }

    var a = self.value.charCodeAt(self.index);
    ++self.index;

    if (a < 55296) {
      return a;
    }

    if (self.index >= self.stop) {
      return -1;
    }

    var b = self.value.charCodeAt(self.index);
    ++self.index;
    return ((a << 10) + b | 0) + ((65536 - (55296 << 10) | 0) - 56320 | 0) | 0;
  };

  var IO = {};

  IO.readFile = function(path) {
    try {
      var contents = require("fs").readFileSync(path, "utf8");
      return new Box(contents.split("\r\n").join("\n"));
    }

    catch ($e) {
    }

    return null;
  };

  IO.writeFile = function(path, contents) {
    try {
      require("fs").writeFileSync(path, contents);
      return true;
    }

    catch ($e) {
    }

    return false;
  };

  var Terminal = {};

  Terminal.setColor = function(color) {
    if (process.stdout.isTTY) {
      process.stdout.write("\x1B[0;" + Terminal.colorToEscapeCode[color].toString() + "m");
    }
  };

  Terminal.Color = {
    DEFAULT: 0,
    BOLD: 1,
    GRAY: 2,
    RED: 3,
    GREEN: 4,
    YELLOW: 5,
    BLUE: 6,
    MAGENTA: 7,
    CYAN: 8
  };

  var in_string = {};

  in_string.startsWith = function(self, text) {
    return self.length >= text.length && self.slice(0, text.length) === text;
  };

  in_string.repeat = function(self, times) {
    var result = "";

    for (var i = 0, count1 = times; i < count1; ++i) {
      result += self;
    }

    return result;
  };

  in_string.codePoints = function(self) {
    var codePoints = [];
    var instance = Unicode.StringIterator.INSTANCE;
    instance.reset(self, 0);

    while (true) {
      var codePoint = instance.nextCodePoint();

      if (codePoint < 0) {
        return codePoints;
      }

      codePoints.push(codePoint);
    }
  };

  in_string.fromCodePoints = function(codePoints) {
    var builder = new StringBuilder();

    for (var i = 0, list = codePoints, count1 = list.length; i < count1; ++i) {
      var codePoint = list[i];

      if (codePoint < 65536) {
        builder.append(String.fromCharCode(codePoint));
      }

      else {
        var adjusted = codePoint - 65536 | 0;
        builder.append(String.fromCharCode((adjusted >> 10) + 55296 | 0));
        builder.append(String.fromCharCode((adjusted & (1 << 10) - 1) + 56320 | 0));
      }
    }

    return builder.toString();
  };

  var in_List = {};

  in_List.isEqualTo = function(self, other) {
    if (self.length !== other.length) {
      return false;
    }

    for (var i = 0, count1 = self.length; i < count1; ++i) {
      if (self[i] !== other[i]) {
        return false;
      }
    }

    return true;
  };

  in_List.last = function(self) {
    return self[self.length - 1 | 0];
  };

  in_List.prepend2 = function(self, values) {
    var count = values.length;

    for (var i = 0, count1 = count; i < count1; ++i) {
      self.unshift(values[(count - i | 0) - 1 | 0]);
    }
  };

  in_List.append2 = function(self, values) {
    for (var i = 0, list = values, count1 = list.length; i < count1; ++i) {
      var value = list[i];
      self.push(value);
    }
  };

  in_List.swap = function(self, i, j) {
    var temp = self[i];
    self[i] = self[j];
    self[j] = temp;
  };

  in_List.removeOne = function(self, value) {
    var index = self.indexOf(value);

    if (index >= 0) {
      self.splice(index, 1);
    }
  };

  in_List.removeIf = function(self, callback) {
    var index = 0;

    // Remove elements in place
    for (var i = 0, count1 = self.length; i < count1; ++i) {
      if (!callback(self[i])) {
        if (index < i) {
          self[index] = self[i];
        }

        ++index;
      }
    }

    // Shrink the array to the correct size
    while (index < self.length) {
      self.pop();
    }
  };

  var in_StringMap = {};

  in_StringMap.insert = function(self, key, value) {
    self[key] = value;
    return self;
  };

  in_StringMap.get = function(self, key, value) {
    return key in self ? self[key] : value;
  };

  in_StringMap.clone = function(self) {
    var clone = Object.create(null);

    for (var i = 0, list = Object.keys(self), count1 = list.length; i < count1; ++i) {
      var key = list[i];
      clone[key] = self[key];
    }

    return clone;
  };

  var in_IntMap = {};

  in_IntMap.insert = function(self, key, value) {
    self[key] = value;
    return self;
  };

  in_IntMap.get = function(self, key, value) {
    return key in self ? self[key] : value;
  };

  in_IntMap.values = function(self) {
    var values = [];

    for (var key in self) {
      values.push(self[key]);
    }

    return values;
  };

  var RELEASE = false;
  Skew.HEX = "0123456789ABCDEF";
  Skew.operatorInfo = in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(Object.create(null), Skew.NodeKind.COMPLEMENT, new Skew.OperatorInfo("~", Skew.Precedence.UNARY_PREFIX, Skew.Associativity.NONE, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ZERO)), Skew.NodeKind.DECREMENT, new Skew.OperatorInfo("--", Skew.Precedence.UNARY_PREFIX, Skew.Associativity.NONE, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ZERO)), Skew.NodeKind.INCREMENT, new Skew.OperatorInfo("++", Skew.Precedence.UNARY_PREFIX, Skew.Associativity.NONE, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ZERO)), Skew.NodeKind.NEGATIVE, new Skew.OperatorInfo("-", Skew.Precedence.UNARY_PREFIX, Skew.Associativity.NONE, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ZERO_OR_ONE)), Skew.NodeKind.NOT, new Skew.OperatorInfo("!", Skew.Precedence.UNARY_PREFIX, Skew.Associativity.NONE, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ZERO)), Skew.NodeKind.POSITIVE, new Skew.OperatorInfo("+", Skew.Precedence.UNARY_PREFIX, Skew.Associativity.NONE, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ZERO_OR_ONE)), Skew.NodeKind.ADD, new Skew.OperatorInfo("+", Skew.Precedence.ADD, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ZERO_OR_ONE)), Skew.NodeKind.BITWISE_AND, new Skew.OperatorInfo("&", Skew.Precedence.BITWISE_AND, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.BITWISE_OR, new Skew.OperatorInfo("|", Skew.Precedence.BITWISE_OR, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.BITWISE_XOR, new Skew.OperatorInfo("^", Skew.Precedence.BITWISE_XOR, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.COMPARE, new Skew.OperatorInfo("<=>", Skew.Precedence.COMPARE, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.DIVIDE, new Skew.OperatorInfo("/", Skew.Precedence.MULTIPLY, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.EQUAL, new Skew.OperatorInfo("==", Skew.Precedence.EQUAL, Skew.Associativity.LEFT, Skew.OperatorKind.FIXED, Skew.ArgumentCount.ONE)), Skew.NodeKind.GREATER_THAN, new Skew.OperatorInfo(">", Skew.Precedence.COMPARE, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.GREATER_THAN_OR_EQUAL, new Skew.OperatorInfo(">=", Skew.Precedence.COMPARE, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.IN, new Skew.OperatorInfo("in", Skew.Precedence.COMPARE, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.IS, new Skew.OperatorInfo("is", Skew.Precedence.COMPARE, Skew.Associativity.LEFT, Skew.OperatorKind.FIXED, Skew.ArgumentCount.ONE)), Skew.NodeKind.LESS_THAN, new Skew.OperatorInfo("<", Skew.Precedence.COMPARE, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.LESS_THAN_OR_EQUAL, new Skew.OperatorInfo("<=", Skew.Precedence.COMPARE, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.LOGICAL_AND, new Skew.OperatorInfo("&&", Skew.Precedence.LOGICAL_AND, Skew.Associativity.LEFT, Skew.OperatorKind.FIXED, Skew.ArgumentCount.ONE)), Skew.NodeKind.LOGICAL_OR, new Skew.OperatorInfo("||", Skew.Precedence.LOGICAL_OR, Skew.Associativity.LEFT, Skew.OperatorKind.FIXED, Skew.ArgumentCount.ONE)), Skew.NodeKind.MULTIPLY, new Skew.OperatorInfo("*", Skew.Precedence.MULTIPLY, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.NOT_EQUAL, new Skew.OperatorInfo("!=", Skew.Precedence.EQUAL, Skew.Associativity.LEFT, Skew.OperatorKind.FIXED, Skew.ArgumentCount.ONE)), Skew.NodeKind.POWER, new Skew.OperatorInfo("**", Skew.Precedence.UNARY_PREFIX, Skew.Associativity.RIGHT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.REMAINDER, new Skew.OperatorInfo("%", Skew.Precedence.MULTIPLY, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.SHIFT_LEFT, new Skew.OperatorInfo("<<", Skew.Precedence.SHIFT, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.SHIFT_RIGHT, new Skew.OperatorInfo(">>", Skew.Precedence.SHIFT, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.SUBTRACT, new Skew.OperatorInfo("-", Skew.Precedence.ADD, Skew.Associativity.LEFT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ZERO_OR_ONE)), Skew.NodeKind.ASSIGN, new Skew.OperatorInfo("=", Skew.Precedence.ASSIGN, Skew.Associativity.RIGHT, Skew.OperatorKind.FIXED, Skew.ArgumentCount.ONE)), Skew.NodeKind.ASSIGN_ADD, new Skew.OperatorInfo("+=", Skew.Precedence.ASSIGN, Skew.Associativity.RIGHT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.ASSIGN_BITWISE_AND, new Skew.OperatorInfo("&=", Skew.Precedence.ASSIGN, Skew.Associativity.RIGHT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.ASSIGN_BITWISE_OR, new Skew.OperatorInfo("|=", Skew.Precedence.ASSIGN, Skew.Associativity.RIGHT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.ASSIGN_BITWISE_XOR, new Skew.OperatorInfo("^=", Skew.Precedence.ASSIGN, Skew.Associativity.RIGHT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.ASSIGN_DIVIDE, new Skew.OperatorInfo("/=", Skew.Precedence.ASSIGN, Skew.Associativity.RIGHT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.ASSIGN_MULTIPLY, new Skew.OperatorInfo("*=", Skew.Precedence.ASSIGN, Skew.Associativity.RIGHT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.ASSIGN_POWER, new Skew.OperatorInfo("**=", Skew.Precedence.ASSIGN, Skew.Associativity.RIGHT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.ASSIGN_REMAINDER, new Skew.OperatorInfo("%=", Skew.Precedence.ASSIGN, Skew.Associativity.RIGHT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.ASSIGN_SHIFT_LEFT, new Skew.OperatorInfo("<<=", Skew.Precedence.ASSIGN, Skew.Associativity.RIGHT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.ASSIGN_SHIFT_RIGHT, new Skew.OperatorInfo(">>=", Skew.Precedence.ASSIGN, Skew.Associativity.RIGHT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.ASSIGN_SUBTRACT, new Skew.OperatorInfo("-=", Skew.Precedence.ASSIGN, Skew.Associativity.RIGHT, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE)), Skew.NodeKind.ASSIGN_INDEX, new Skew.OperatorInfo("[]=", Skew.Precedence.MEMBER, Skew.Associativity.NONE, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.TWO_OR_MORE)), Skew.NodeKind.INDEX, new Skew.OperatorInfo("[]", Skew.Precedence.MEMBER, Skew.Associativity.NONE, Skew.OperatorKind.OVERRIDABLE, Skew.ArgumentCount.ONE_OR_MORE));
  Skew.argumentCounts = null;
  Skew.yy_accept = [Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.END_OF_FILE, Skew.TokenKind.ERROR, Skew.TokenKind.WHITESPACE, Skew.TokenKind.NEWLINE, Skew.TokenKind.NOT, Skew.TokenKind.ERROR, Skew.TokenKind.COMMENT, Skew.TokenKind.REMAINDER, Skew.TokenKind.BITWISE_AND, Skew.TokenKind.ERROR, Skew.TokenKind.LEFT_PARENTHESIS, Skew.TokenKind.RIGHT_PARENTHESIS, Skew.TokenKind.MULTIPLY, Skew.TokenKind.PLUS, Skew.TokenKind.COMMA, Skew.TokenKind.MINUS, Skew.TokenKind.DOT, Skew.TokenKind.DIVIDE, Skew.TokenKind.INT, Skew.TokenKind.INT, Skew.TokenKind.COLON, Skew.TokenKind.LESS_THAN, Skew.TokenKind.ASSIGN, Skew.TokenKind.GREATER_THAN, Skew.TokenKind.QUESTION_MARK, Skew.TokenKind.ERROR, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.LEFT_BRACKET, Skew.TokenKind.RIGHT_BRACKET, Skew.TokenKind.BITWISE_XOR, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.LEFT_BRACE, Skew.TokenKind.BITWISE_OR, Skew.TokenKind.RIGHT_BRACE, Skew.TokenKind.TILDE, Skew.TokenKind.WHITESPACE, Skew.TokenKind.NEWLINE, Skew.TokenKind.NOT_EQUAL, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.STRING, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.COMMENT, Skew.TokenKind.COMMENT, Skew.TokenKind.ASSIGN_REMAINDER, Skew.TokenKind.LOGICAL_AND, Skew.TokenKind.ASSIGN_BITWISE_AND, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.CHARACTER, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.POWER, Skew.TokenKind.ASSIGN_MULTIPLY, Skew.TokenKind.INCREMENT, Skew.TokenKind.ASSIGN_PLUS, Skew.TokenKind.DECREMENT, Skew.TokenKind.ASSIGN_MINUS, Skew.TokenKind.DOT_DOT, Skew.TokenKind.ASSIGN_DIVIDE, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.INT, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.SHIFT_LEFT, Skew.TokenKind.LESS_THAN_OR_EQUAL, Skew.TokenKind.EQUAL, Skew.TokenKind.ARROW, Skew.TokenKind.GREATER_THAN_OR_EQUAL, Skew.TokenKind.SHIFT_RIGHT, Skew.TokenKind.ANNOTATION, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.INDEX, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.ASSIGN_BITWISE_XOR, Skew.TokenKind.AS, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IF, Skew.TokenKind.IN, Skew.TokenKind.IS, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.ASSIGN_BITWISE_OR, Skew.TokenKind.LOGICAL_OR, Skew.TokenKind.ASSIGN_POWER, Skew.TokenKind.DOUBLE, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.DOUBLE, Skew.TokenKind.INT_BINARY, Skew.TokenKind.INT_OCTAL, Skew.TokenKind.INT_HEX, Skew.TokenKind.ASSIGN_SHIFT_LEFT, Skew.TokenKind.COMPARE, Skew.TokenKind.ASSIGN_SHIFT_RIGHT, Skew.TokenKind.ANNOTATION, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.ASSIGN_INDEX, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.DEF, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.FOR, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.TRY, Skew.TokenKind.VAR, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.CASE, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.ELSE, Skew.TokenKind.ENUM, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.NULL, Skew.TokenKind.OVER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.TRUE, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.YY_INVALID_ACTION, Skew.TokenKind.LIST, Skew.TokenKind.LIST_NEW, Skew.TokenKind.BREAK, Skew.TokenKind.CATCH, Skew.TokenKind.CLASS, Skew.TokenKind.CONST, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.FALSE, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.SUPER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.THROW, Skew.TokenKind.WHILE, Skew.TokenKind.SET, Skew.TokenKind.SET_NEW, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.RETURN, Skew.TokenKind.SWITCH, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.DEFAULT, Skew.TokenKind.DYNAMIC, Skew.TokenKind.FINALLY, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.CONTINUE, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.IDENTIFIER, Skew.TokenKind.INTERFACE, Skew.TokenKind.NAMESPACE, Skew.TokenKind.YY_INVALID_ACTION];
  Skew.yy_ec = [0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 4, 5, 6, 1, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 20, 20, 20, 20, 20, 21, 21, 22, 1, 23, 24, 25, 26, 27, 28, 28, 28, 28, 29, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 31, 32, 33, 34, 30, 1, 35, 36, 37, 38, 39, 40, 30, 41, 42, 30, 43, 44, 45, 46, 47, 48, 30, 49, 50, 51, 52, 53, 54, 55, 56, 30, 57, 58, 59, 60, 1];
  Skew.yy_meta = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 3, 3, 4, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1, 1, 1];
  Skew.yy_base = [0, 0, 0, 306, 307, 303, 59, 280, 58, 300, 278, 56, 56, 307, 307, 54, 55, 307, 52, 285, 276, 75, 53, 307, 60, 61, 73, 307, 0, 0, 54, 307, 275, 248, 248, 66, 50, 31, 70, 69, 64, 243, 256, 66, 80, 259, 252, 86, 79, 307, 307, 290, 105, 307, 118, 307, 288, 287, 307, 307, 307, 307, 115, 307, 286, 264, 307, 307, 307, 307, 307, 307, 307, 107, 115, 138, 120, 122, 0, 263, 261, 307, 307, 307, 261, 0, 0, 268, 259, 243, 307, 0, 242, 95, 245, 233, 238, 231, 226, 223, 230, 227, 223, 0, 220, 0, 225, 225, 229, 216, 218, 223, 215, 96, 214, 220, 245, 221, 307, 307, 307, 142, 146, 150, 154, 156, 0, 307, 307, 307, 0, 243, 307, 204, 222, 217, 218, 204, 127, 218, 217, 212, 205, 199, 213, 0, 208, 207, 201, 195, 191, 203, 190, 193, 200, 0, 0, 194, 221, 182, 202, 201, 190, 0, 191, 181, 179, 187, 176, 182, 0, 0, 187, 181, 175, 173, 0, 0, 173, 172, 183, 165, 0, 179, 158, 157, 307, 307, 0, 0, 0, 0, 169, 170, 171, 0, 168, 171, 162, 163, 0, 167, 0, 0, 307, 307, 155, 155, 168, 148, 168, 167, 0, 0, 162, 0, 0, 0, 118, 112, 0, 104, 42, 0, 0, 307, 178, 182, 186, 188, 191, 194, 196];
  Skew.yy_def = [0, 225, 1, 225, 225, 225, 225, 225, 226, 227, 225, 225, 228, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 229, 230, 225, 225, 225, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 225, 225, 225, 225, 225, 225, 225, 226, 225, 226, 227, 225, 225, 225, 225, 228, 225, 228, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 231, 225, 225, 225, 225, 225, 225, 232, 230, 225, 225, 225, 225, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 231, 225, 225, 225, 232, 225, 225, 225, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 225, 225, 225, 225, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 225, 225, 225, 225, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 225, 225, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 0, 225, 225, 225, 225, 225, 225, 225];
  Skew.yy_nxt = [0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 22, 22, 23, 24, 25, 26, 27, 28, 29, 29, 29, 30, 4, 31, 32, 33, 34, 35, 36, 37, 38, 29, 39, 29, 29, 29, 40, 41, 29, 42, 43, 44, 29, 45, 46, 29, 29, 47, 48, 49, 50, 52, 52, 55, 60, 63, 65, 69, 67, 73, 87, 74, 74, 74, 74, 98, 70, 99, 66, 68, 61, 224, 75, 79, 80, 81, 82, 88, 64, 96, 56, 73, 75, 74, 74, 74, 74, 83, 84, 106, 89, 93, 116, 118, 75, 100, 97, 52, 52, 103, 94, 76, 101, 95, 75, 104, 107, 102, 110, 105, 111, 112, 77, 55, 63, 121, 121, 121, 121, 113, 78, 73, 117, 74, 74, 74, 74, 119, 124, 124, 125, 125, 125, 223, 75, 135, 136, 64, 154, 222, 56, 122, 155, 122, 75, 221, 123, 123, 123, 123, 121, 121, 121, 121, 123, 123, 123, 123, 123, 123, 123, 123, 124, 124, 125, 125, 125, 166, 167, 54, 54, 54, 54, 57, 57, 57, 57, 62, 62, 62, 62, 85, 85, 86, 86, 86, 126, 126, 130, 130, 130, 220, 219, 218, 217, 216, 215, 214, 213, 212, 211, 210, 209, 208, 207, 206, 205, 204, 203, 202, 201, 200, 199, 198, 197, 196, 195, 194, 193, 192, 191, 190, 189, 188, 187, 186, 185, 184, 183, 182, 181, 180, 179, 178, 177, 176, 175, 174, 173, 172, 171, 170, 169, 168, 165, 164, 163, 162, 161, 160, 159, 158, 157, 156, 153, 152, 151, 150, 149, 148, 147, 146, 145, 144, 143, 142, 141, 140, 139, 138, 137, 134, 133, 132, 131, 129, 128, 127, 120, 225, 58, 225, 51, 115, 114, 109, 108, 92, 91, 90, 72, 71, 59, 58, 53, 51, 225, 3, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225];
  Skew.yy_chk = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 6, 6, 8, 11, 12, 15, 18, 16, 22, 30, 22, 22, 22, 22, 37, 18, 37, 15, 16, 11, 222, 22, 24, 24, 25, 25, 30, 12, 36, 8, 21, 22, 21, 21, 21, 21, 26, 26, 40, 30, 35, 47, 48, 21, 38, 36, 52, 52, 39, 35, 21, 38, 35, 21, 39, 40, 38, 43, 39, 43, 44, 21, 54, 62, 73, 73, 73, 73, 44, 21, 74, 47, 74, 74, 74, 74, 48, 76, 76, 77, 77, 77, 221, 74, 93, 93, 62, 113, 219, 54, 75, 113, 75, 74, 218, 75, 75, 75, 75, 121, 121, 121, 121, 122, 122, 122, 122, 123, 123, 123, 123, 124, 124, 125, 125, 125, 138, 138, 226, 226, 226, 226, 227, 227, 227, 227, 228, 228, 228, 228, 229, 229, 230, 230, 230, 231, 231, 232, 232, 232, 214, 211, 210, 209, 208, 207, 206, 201, 199, 198, 197, 196, 194, 193, 192, 185, 184, 183, 181, 180, 179, 178, 175, 174, 173, 172, 169, 168, 167, 166, 165, 164, 162, 161, 160, 159, 158, 157, 154, 153, 152, 151, 150, 149, 148, 147, 146, 144, 143, 142, 141, 140, 139, 137, 136, 135, 134, 133, 131, 117, 116, 115, 114, 112, 111, 110, 109, 108, 107, 106, 104, 102, 101, 100, 99, 98, 97, 96, 95, 94, 92, 89, 88, 87, 84, 80, 79, 65, 64, 57, 56, 51, 46, 45, 42, 41, 34, 33, 32, 20, 19, 10, 9, 7, 5, 3, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225, 225];
  Skew.REMOVE_NEWLINE_BEFORE = in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(Object.create(null), Skew.TokenKind.COLON, 0), Skew.TokenKind.COMMA, 0), Skew.TokenKind.QUESTION_MARK, 0), Skew.TokenKind.RIGHT_BRACKET, 0), Skew.TokenKind.RIGHT_PARENTHESIS, 0);
  Skew.KEEP_NEWLINE_BEFORE = in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(Object.create(null), Skew.TokenKind.ANNOTATION, 0), Skew.TokenKind.CLASS, 0), Skew.TokenKind.COMMENT, 0), Skew.TokenKind.DEF, 0), Skew.TokenKind.INTERFACE, 0), Skew.TokenKind.NAMESPACE, 0), Skew.TokenKind.VAR, 0);
  Skew.REMOVE_NEWLINE_AFTER = in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(Object.create(null), Skew.TokenKind.ARROW, 0), Skew.TokenKind.COLON, 0), Skew.TokenKind.COMMA, 0), Skew.TokenKind.NEWLINE, 0), Skew.TokenKind.QUESTION_MARK, 0), Skew.TokenKind.LEFT_BRACE, 0), Skew.TokenKind.LEFT_BRACKET, 0), Skew.TokenKind.LEFT_PARENTHESIS, 0), Skew.TokenKind.BITWISE_AND, 0), Skew.TokenKind.BITWISE_OR, 0), Skew.TokenKind.BITWISE_XOR, 0), Skew.TokenKind.DIVIDE, 0), Skew.TokenKind.EQUAL, 0), Skew.TokenKind.GREATER_THAN, 0), Skew.TokenKind.GREATER_THAN_OR_EQUAL, 0), Skew.TokenKind.LESS_THAN, 0), Skew.TokenKind.LESS_THAN_OR_EQUAL, 0), Skew.TokenKind.LOGICAL_AND, 0), Skew.TokenKind.LOGICAL_OR, 0), Skew.TokenKind.MINUS, 0), Skew.TokenKind.MULTIPLY, 0), Skew.TokenKind.NOT_EQUAL, 0), Skew.TokenKind.PLUS, 0), Skew.TokenKind.REMAINDER, 0), Skew.TokenKind.SHIFT_LEFT, 0), Skew.TokenKind.SHIFT_RIGHT, 0), Skew.TokenKind.ASSIGN, 0), Skew.TokenKind.ASSIGN_PLUS, 0), Skew.TokenKind.ASSIGN_BITWISE_AND, 0), Skew.TokenKind.ASSIGN_BITWISE_OR, 0), Skew.TokenKind.ASSIGN_BITWISE_XOR, 0), Skew.TokenKind.ASSIGN_DIVIDE, 0), Skew.TokenKind.ASSIGN_MULTIPLY, 0), Skew.TokenKind.ASSIGN_REMAINDER, 0), Skew.TokenKind.ASSIGN_SHIFT_LEFT, 0), Skew.TokenKind.ASSIGN_SHIFT_RIGHT, 0), Skew.TokenKind.ASSIGN_MINUS, 0);
  Skew.NATIVE_LIBRARY = "\nconst RELEASE = false\n\nenum Target {\n  NONE\n  JAVASCRIPT\n}\n\nconst TARGET Target = .NONE\n\ndef @deprecated\ndef @deprecated(message string)\ndef @entry\ndef @export\ndef @import\ndef @prefer\ndef @private\ndef @protected\ndef @rename(name string)\ndef @skip\n\n@skip if RELEASE\ndef assert(truth bool)\n\n@import\nnamespace Math {\n  def abs(x double) double\n  def abs(x int) int\n  def acos(x double) double\n  def asin(x double) double\n  def atan(x double) double\n  def atan2(x double, y double) double\n  def ceil(x double) double\n  def cos(x double) double\n  def exp(x double) double\n  def floor(x double) double\n  def log(x double) double\n  def pow(x double, y double) double\n  def random double\n  def round(x double) double\n  def sin(x double) double\n  def sqrt(x double) double\n  def tan(x double) double\n\n  @prefer\n  def max(x double, y double) double\n  def max(x int, y int) int\n\n  @prefer\n  def min(x double, y double) double\n  def min(x int, y int) int\n\n  const E = 2.718281828459045\n  const INFINITY = 1 / 0.0\n  const NAN = 0 / 0.0\n  const PI = 3.141592653589793\n}\n\n@import\nclass bool {\n  def ! bool\n  def toString string\n}\n\n@import\nclass int {\n  def + int\n  def ++\n  def - int\n  def --\n  def toString string\n  def ~ int\n\n  def %(x int) int\n  def &(x int) int\n  def *(x int) int\n  def +(x int) int\n  def -(x int) int\n  def /(x int) int\n  def <<(x int) int\n  def <=>(x int) int\n  def >>(x int) int\n  def ^(x int) int\n  def |(x int) int\n\n  def %=(x int)\n  def &=(x int)\n  def *=(x int)\n  def +=(x int)\n  def -=(x int)\n  def /=(x int)\n  def <<=(x int)\n  def >>=(x int)\n  def ^=(x int)\n  def |=(x int)\n}\n\n@import\nclass double {\n  def + double\n  def ++\n  def - double\n  def --\n  def toString string\n\n  def *(x double) double\n  def **(x double) double\n  def +(x double) double\n  def -(x double) double\n  def /(x double) double\n  def <=>(x double) double\n\n  def **=(x double)\n  def *=(x double)\n  def +=(x double)\n  def -=(x double)\n  def /=(x double)\n\n  def isFinite bool\n  def isNAN bool\n}\n\n@import\nclass string {\n  def +(x string) string\n  def +=(x string)\n  def <=>(x string) int\n  def [](x int) int\n  def codePoints List<int>\n  def codeUnits List<int>\n  def count int\n  def endsWith(x string) bool\n  def get(x int) string\n  def in(x string) bool\n  def indexOf(x string) int\n  def join(x List<string>) string\n  def lastIndexOf(x string) int\n  def repeat(x int) string\n  def replaceAll(before string, after string) string\n  def slice(start int) string\n  def slice(start int, end int) string\n  def split(x string) List<string>\n  def startsWith(x string) bool\n  def toLowerCase string\n  def toUpperCase string\n}\n\nnamespace string {\n  def fromCodePoint(x int) string\n  def fromCodePoints(x List<int>) string\n  def fromCodeUnit(x int) string\n  def fromCodeUnits(x List<int>) string\n}\n\n@import if TARGET != .JAVASCRIPT\nclass StringBuilder {\n  def append(x string)\n  def new\n  def toString string\n}\n\n@import\nclass List<T> {\n  def [...](x T) List<T>\n  def [](x int) T\n  def []=(x int, y T)\n  def all(x fn(T) bool) bool\n  def any(x fn(T) bool) bool\n  def appendOne(x T)\n  def clone List<T>\n  def count int\n  def each(x fn(T))\n  def filter(x fn(T) bool) List<T>\n  def first T\n  def in(x T) bool\n  def indexOf(x T) int\n  def insert(x int, value T)\n  def isEmpty bool\n  def isEqualTo(other List<T>) bool\n  def last T\n  def lastIndexOf(x T) int\n  def map<R>(x fn(T) R) List<R>\n  def new\n  def removeAll(x T)\n  def removeAt(x int)\n  def removeDuplicates\n  def removeFirst\n  def removeIf(x fn(T) bool)\n  def removeLast\n  def removeOne(x T)\n  def removeRange(start int, end int)\n  def resize(size int, defaultValue T)\n  def reverse\n  def shuffle\n  def slice(start int) List<T>\n  def slice(start int, end int) List<T>\n  def sort(x fn(T, T) int)\n  def swap(x int, y int)\n  def takeFirst T\n  def takeLast T\n  def takeRange(start int, end int) List<T>\n\n  @prefer\n  def append(x T)\n  def append(x List<T>)\n\n  @prefer\n  def prepend(x T)\n  def prepend(x List<T>)\n\n  @prefer\n  def +(x T) List<T>\n  def +(x List<T>) List<T>\n\n  @prefer\n  def +=(x T)\n  def +=(x List<T>)\n}\n\n@import\nclass StringMap<T> {\n  def [](key string) T\n  def []=(key string, value T)\n  def clone StringMap<T>\n  def count int\n  def each(x fn(string, T))\n  def get(key string, defaultValue T) T\n  def in(key string) bool\n  def isEmpty bool\n  def keys List<string>\n  def new\n  def remove(key string)\n  def values List<T>\n  def {...}(key string, value T) StringMap<T>\n}\n\n@import\nclass IntMap<T> {\n  def [](key int) T\n  def []=(key int, value T)\n  def clone IntMap<T>\n  def count int\n  def each(x fn(int, T))\n  def get(key int, defaultValue T) T\n  def in(key int) bool\n  def isEmpty bool\n  def keys List<int>\n  def new\n  def remove(key int)\n  def values List<T>\n  def {...}(key int, value T) IntMap<T>\n}\n\nclass Box<T> {\n  var value T\n}\n";
  Skew.NATIVE_LIBRARY_JS = "\nconst __extends = (derived dynamic, base dynamic) => {\n  derived.prototype = dynamic.Object.create(base.prototype)\n  derived.prototype.constructor = derived\n}\n\nconst __imul = dynamic.Math.imul ? dynamic.Math.imul : (a int, b int) int => {\n  const ah dynamic = (a >> 16) & 65535\n  const bh dynamic = (b >> 16) & 65535\n  const al dynamic = a & 65535\n  const bl dynamic = b & 65535\n  return al * bl + ((ah * bl + al * bh) << 16) | 0\n}\n\ndef assert(truth bool) {\n  if !truth {\n    throw dynamic.Error(\"Assertion failed\")\n  }\n}\n\nclass double {\n  def isFinite bool {\n    return dynamic.isFinite(self)\n  }\n\n  def isNAN bool {\n    return dynamic.isNaN(self)\n  }\n}\n\nclass string {\n  def startsWith(text string) bool {\n    return count >= text.count && slice(0, text.count) == text\n  }\n\n  def replaceAll(before string, after string) string {\n    return after.join(self.split(before))\n  }\n\n  def in(value string) bool {\n    return indexOf(value) != -1\n  }\n\n  def count int {\n    return (self as dynamic).length\n  }\n\n  def [](index int) int {\n    return (self as dynamic).charCodeAt(index)\n  }\n\n  def get(index int) string {\n    return (self as dynamic)[index]\n  }\n\n  def repeat(times int) string {\n    var result = \"\"\n    for i in 0..times {\n      result += self\n    }\n    return result\n  }\n\n  def join(parts List<string>) string {\n    return (parts as dynamic).join(self)\n  }\n}\n\nnamespace string {\n  def fromCodeUnit(x int) string {\n    return dynamic.String.fromCharCode(x)\n  }\n}\n\nclass StringBuilder {\n  var buffer = \"\"\n\n  def new {\n  }\n\n  def append(x string) {\n    buffer += x\n  }\n\n  def toString string {\n    return buffer\n  }\n}\n\nclass List {\n  def all(callback fn(T) bool) bool {\n    return (self as dynamic).every(callback)\n  }\n\n  def any(callback fn(T) bool) bool {\n    return (self as dynamic).some(callback)\n  }\n\n  def isEqualTo(other List<T>) bool {\n    if count != other.count {\n      return false\n    }\n    for i in 0..count {\n      if self[i] != other[i] {\n        return false\n      }\n    }\n    return true\n  }\n\n  def in(value T) bool {\n    return indexOf(value) != -1\n  }\n\n  def isEmpty bool {\n    return count == 0\n  }\n\n  def count int {\n    return (self as dynamic).length\n  }\n\n  def first T {\n    return self[0]\n  }\n\n  def last T {\n    return self[count - 1]\n  }\n\n  def prepend(value T) {\n    (self as dynamic).unshift(value)\n  }\n\n  def prepend(values List<T>) {\n    var count = values.count\n    for i in 0..count {\n      prepend(values[count - i - 1])\n    }\n  }\n\n  def append(value T) {\n    (self as dynamic).push(value)\n  }\n\n  def append(values List<T>) {\n    for value in values {\n      append(value)\n    }\n  }\n\n  def removeFirst {\n    (self as dynamic).shift()\n  }\n\n  def removeLast {\n    (self as dynamic).pop()\n  }\n\n  def takeFirst T {\n    return (self as dynamic).shift()\n  }\n\n  def takeLast T {\n    return (self as dynamic).pop()\n  }\n\n  def swap(i int, j int) {\n    var temp = self[i]\n    self[i] = self[j]\n    self[j] = temp\n  }\n\n  def insert(index int, value T) {\n    (self as dynamic).splice(index, 0, value)\n  }\n\n  def removeAt(index int) {\n    (self as dynamic).splice(index, 1)\n  }\n\n  def removeOne(value T) {\n    var index = indexOf(value)\n    if index >= 0 {\n      removeAt(index)\n    }\n  }\n\n  def clone List<T> {\n    return (self as dynamic).slice()\n  }\n\n  def removeIf(callback fn(T) bool) {\n    var index = 0\n\n    # Remove elements in place\n    for i in 0..count {\n      if !callback(self[i]) {\n        if index < i {\n          self[index] = self[i]\n        }\n        index++\n      }\n    }\n\n    # Shrink the array to the correct size\n    while index < count {\n      removeLast\n    }\n  }\n}\n\nnamespace StringMap {\n  def new StringMap<T> {\n    return dynamic.Object.create(null)\n  }\n}\n\nclass StringMap {\n  def {...}(key string, value T) StringMap<T> {\n    self[key] = value\n    return self\n  }\n\n  def get(key string, value T) T {\n    return key in self ? self[key] : value\n  }\n\n  def keys List<string> {\n    return dynamic.Object.keys(self)\n  }\n\n  def values List<T> {\n    var values List<T> = []\n    for key in self as dynamic {\n      values.append(self[key])\n    }\n    return values\n  }\n\n  def clone StringMap<T> {\n    var clone = new\n    for key in keys {\n      clone[key] = self[key]\n    }\n    return clone\n  }\n\n  def remove(key string) {\n    dynamic.delete(self[key])\n  }\n}\n\nnamespace IntMap {\n  def new IntMap<T> {\n    return dynamic.Object.create(null)\n  }\n}\n\nclass IntMap {\n  def {...}(key int, value T) IntMap<T> {\n    self[key] = value\n    return self\n  }\n\n  def get(key int, value T) T {\n    return key in self ? self[key] : value\n  }\n\n  def keys List<int> {\n    var keys List<int> = []\n    for key in dynamic.Object.keys(self) as List<string> {\n      keys.append(key as dynamic as int)\n    }\n    return keys\n  }\n\n  def values List<T> {\n    var values List<T> = []\n    for key in self as dynamic {\n      values.append(self[key])\n    }\n    return values\n  }\n\n  def clone IntMap<T> {\n    var clone = new\n    for key in keys {\n      clone[key] = self[key]\n    }\n    return clone\n  }\n\n  def remove(key int) {\n    dynamic.delete(self[key])\n  }\n}\n";
  Skew.DEFAULT_MESSAGE_LIMIT = 10;
  Skew.JsEmitter.isFunctionProperty = in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(Object.create(null), "apply", 0), "call", 0), "length", 0), "name", 0);
  Skew.JsEmitter.isKeyword = in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(Object.create(null), "arguments", 0), "Boolean", 0), "break", 0), "case", 0), "catch", 0), "class", 0), "const", 0), "constructor", 0), "continue", 0), "Date", 0), "debugger", 0), "default", 0), "delete", 0), "do", 0), "double", 0), "else", 0), "export", 0), "extends", 0), "false", 0), "finally", 0), "float", 0), "for", 0), "Function", 0), "function", 0), "if", 0), "import", 0), "in", 0), "instanceof", 0), "int", 0), "let", 0), "new", 0), "null", 0), "Number", 0), "Object", 0), "return", 0), "String", 0), "super", 0), "this", 0), "throw", 0), "true", 0), "try", 0), "var", 0);
  Skew.NodeKind.strings = ["ANNOTATION", "BLOCK", "CASE", "CATCH", "BREAK", "CONTINUE", "EXPRESSION", "FOR", "FOREACH", "IF", "RETURN", "SWITCH", "THROW", "TRY", "VAR", "WHILE", "ASSIGN_INDEX", "CALL", "CAST", "CONSTANT", "DOT", "DYNAMIC", "HOOK", "INDEX", "INITIALIZER_LIST", "INITIALIZER_MAP", "INITIALIZER_SET", "LAMBDA", "LAMBDA_TYPE", "NAME", "NULL", "PAIR", "PARAMETERIZE", "SEQUENCE", "SUPER", "TYPE", "COMPLEMENT", "DECREMENT", "INCREMENT", "NEGATIVE", "NOT", "POSITIVE", "ADD", "BITWISE_AND", "BITWISE_OR", "BITWISE_XOR", "COMPARE", "DIVIDE", "EQUAL", "IN", "IS", "LOGICAL_AND", "LOGICAL_OR", "MULTIPLY", "NOT_EQUAL", "POWER", "REMAINDER", "SHIFT_LEFT", "SHIFT_RIGHT", "SUBTRACT", "GREATER_THAN", "GREATER_THAN_OR_EQUAL", "LESS_THAN", "LESS_THAN_OR_EQUAL", "ASSIGN", "ASSIGN_ADD", "ASSIGN_BITWISE_AND", "ASSIGN_BITWISE_OR", "ASSIGN_BITWISE_XOR", "ASSIGN_DIVIDE", "ASSIGN_MULTIPLY", "ASSIGN_POWER", "ASSIGN_REMAINDER", "ASSIGN_SHIFT_LEFT", "ASSIGN_SHIFT_RIGHT", "ASSIGN_SUBTRACT"];
  Skew.Node.IS_IMPLICIT_RETURN = 1 << 0;
  Skew.Node.IS_INSIDE_PARENTHESES = 1 << 1;
  Skew.SymbolKind.strings = ["PARAMETER_FUNCTION", "PARAMETER_OBJECT", "OBJECT_CLASS", "OBJECT_ENUM", "OBJECT_GLOBAL", "OBJECT_INTERFACE", "OBJECT_NAMESPACE", "FUNCTION_ANNOTATION", "FUNCTION_CONSTRUCTOR", "FUNCTION_GLOBAL", "FUNCTION_INSTANCE", "FUNCTION_LOCAL", "OVERLOADED_ANNOTATION", "OVERLOADED_GLOBAL", "OVERLOADED_INSTANCE", "VARIABLE_ENUM", "VARIABLE_GLOBAL", "VARIABLE_INSTANCE", "VARIABLE_LOCAL"];

  // Flags
  Skew.Symbol.IS_AUTOMATICALLY_GENERATED = 1 << 0;
  Skew.Symbol.IS_CONST = 1 << 1;
  Skew.Symbol.IS_GETTER = 1 << 2;
  Skew.Symbol.IS_LOOP_VARIABLE = 1 << 3;
  Skew.Symbol.IS_OVER = 1 << 4;
  Skew.Symbol.IS_SETTER = 1 << 5;
  Skew.Symbol.IS_VALUE_TYPE = 1 << 6;
  Skew.Symbol.SHOULD_INFER_RETURN_TYPE = 1 << 7;

  // Modifiers
  Skew.Symbol.IS_DEPRECATED = 1 << 8;
  Skew.Symbol.IS_ENTRY_POINT = 1 << 9;
  Skew.Symbol.IS_EXPORTED = 1 << 10;
  Skew.Symbol.IS_IMPORTED = 1 << 11;
  Skew.Symbol.IS_PREFERRED = 1 << 12;
  Skew.Symbol.IS_PRIVATE = 1 << 13;
  Skew.Symbol.IS_PROTECTED = 1 << 14;
  Skew.Symbol.IS_RENAMED = 1 << 15;
  Skew.Symbol.IS_SKIPPED = 1 << 16;

  // Pass-specific flags
  Skew.Symbol.IS_MERGED = 1 << 17;
  Skew.Symbol.IS_OBSOLETE = 1 << 18;
  Skew.Symbol.IS_PRIMARY_CONSTRUCTOR = 1 << 19;
  Skew.Symbol.nextID = 0;
  Skew.TokenKind.strings = ["ANNOTATION", "ARROW", "AS", "ASSIGN", "ASSIGN_BITWISE_AND", "ASSIGN_BITWISE_OR", "ASSIGN_BITWISE_XOR", "ASSIGN_DIVIDE", "ASSIGN_INDEX", "ASSIGN_MINUS", "ASSIGN_MULTIPLY", "ASSIGN_PLUS", "ASSIGN_POWER", "ASSIGN_REMAINDER", "ASSIGN_SHIFT_LEFT", "ASSIGN_SHIFT_RIGHT", "BITWISE_AND", "BITWISE_OR", "BITWISE_XOR", "BREAK", "CASE", "CATCH", "CHARACTER", "CLASS", "COLON", "COMMA", "COMMENT", "COMPARE", "CONST", "CONTINUE", "DECREMENT", "DEF", "DEFAULT", "DIVIDE", "DOT", "DOT_DOT", "DOUBLE", "DYNAMIC", "ELSE", "END_OF_FILE", "ENUM", "EQUAL", "ERROR", "FALSE", "FINALLY", "FOR", "GREATER_THAN", "GREATER_THAN_OR_EQUAL", "IDENTIFIER", "IF", "IN", "INCREMENT", "INDEX", "INT", "INTERFACE", "INT_BINARY", "INT_HEX", "INT_OCTAL", "IS", "LEFT_BRACE", "LEFT_BRACKET", "LEFT_PARENTHESIS", "LESS_THAN", "LESS_THAN_OR_EQUAL", "LIST", "LIST_NEW", "LOGICAL_AND", "LOGICAL_OR", "MINUS", "MULTIPLY", "NAMESPACE", "NEWLINE", "NOT", "NOT_EQUAL", "NULL", "OVER", "PLUS", "POWER", "QUESTION_MARK", "REMAINDER", "RETURN", "RIGHT_BRACE", "RIGHT_BRACKET", "RIGHT_PARENTHESIS", "SET", "SET_NEW", "SHIFT_LEFT", "SHIFT_RIGHT", "STRING", "SUPER", "SWITCH", "THROW", "TILDE", "TRUE", "TRY", "VAR", "WHILE", "WHITESPACE", "YY_INVALID_ACTION", "START_PARAMETER_LIST", "END_PARAMETER_LIST"];
  Skew.Parsing.operatorOverloadTokenKinds = in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(Object.create(null), Skew.TokenKind.ASSIGN_BITWISE_AND, 0), Skew.TokenKind.ASSIGN_BITWISE_OR, 0), Skew.TokenKind.ASSIGN_BITWISE_XOR, 0), Skew.TokenKind.ASSIGN_DIVIDE, 0), Skew.TokenKind.ASSIGN_INDEX, 0), Skew.TokenKind.ASSIGN_MINUS, 0), Skew.TokenKind.ASSIGN_MULTIPLY, 0), Skew.TokenKind.ASSIGN_PLUS, 0), Skew.TokenKind.ASSIGN_POWER, 0), Skew.TokenKind.ASSIGN_REMAINDER, 0), Skew.TokenKind.ASSIGN_SHIFT_LEFT, 0), Skew.TokenKind.ASSIGN_SHIFT_RIGHT, 0), Skew.TokenKind.BITWISE_AND, 0), Skew.TokenKind.BITWISE_OR, 0), Skew.TokenKind.BITWISE_XOR, 0), Skew.TokenKind.COMPARE, 0), Skew.TokenKind.DECREMENT, 0), Skew.TokenKind.DIVIDE, 0), Skew.TokenKind.IN, 0), Skew.TokenKind.INCREMENT, 0), Skew.TokenKind.INDEX, 0), Skew.TokenKind.LIST, 0), Skew.TokenKind.MINUS, 0), Skew.TokenKind.MULTIPLY, 0), Skew.TokenKind.NOT, 0), Skew.TokenKind.PLUS, 0), Skew.TokenKind.POWER, 0), Skew.TokenKind.REMAINDER, 0), Skew.TokenKind.SET, 0), Skew.TokenKind.SHIFT_LEFT, 0), Skew.TokenKind.SHIFT_RIGHT, 0), Skew.TokenKind.TILDE, 0);
  Skew.Parsing.dotInfixParselet = function(context, left) {
    context.next();
    var range = context.current().range;

    if (!context.expect(Skew.TokenKind.IDENTIFIER)) {
      return null;
    }

    return new Skew.Node(Skew.NodeKind.DOT).withContent(new Skew.StringContent(range.toString())).withChildren([left]).withRange(context.spanSince(left.range)).withInternalRange(range);
  };
  Skew.Parsing.initializerParselet = function(context) {
    var token = context.next();
    var values = [];
    var kind = token.kind === Skew.TokenKind.LEFT_BRACE || token.kind === Skew.TokenKind.SET_NEW ? Skew.NodeKind.INITIALIZER_SET : Skew.NodeKind.INITIALIZER_LIST;

    if (token.kind === Skew.TokenKind.LEFT_BRACE || token.kind === Skew.TokenKind.LEFT_BRACKET) {
      var checkForColon = kind !== Skew.NodeKind.INITIALIZER_LIST;
      var end = checkForColon ? Skew.TokenKind.RIGHT_BRACE : Skew.TokenKind.RIGHT_BRACKET;

      while (true) {
        context.eat(Skew.TokenKind.NEWLINE);
        var comments = Skew.Parsing.parseLeadingComments(context);

        if (context.peek(end)) {
          break;
        }

        var first = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

        if (first === null) {
          return null;
        }

        var colon = context.current();

        if (!checkForColon || values.length === 0 && !context.peek(Skew.TokenKind.COLON)) {
          values.push(first);
          checkForColon = false;
        }

        else {
          if (!context.expect(Skew.TokenKind.COLON)) {
            return null;
          }

          var second = Skew.Parsing.pratt.parse(context, Skew.Precedence.LOWEST);

          if (second === null) {
            return null;
          }

          first = Skew.Node.createPair(first, second).withRange(Skew.Range.span(first.range, second.range)).withInternalRange(colon.range);
          values.push(first);
          kind = Skew.NodeKind.INITIALIZER_MAP;
        }

        first.comments = comments;

        if (!context.eat(Skew.TokenKind.COMMA)) {
          break;
        }
      }

      while (context.eat(Skew.TokenKind.COMMENT) || context.eat(Skew.TokenKind.NEWLINE)) {
      }

      if (!context.expect(end)) {
        return null;
      }
    }

    else if (token.kind === Skew.TokenKind.LIST_NEW || token.kind === Skew.TokenKind.SET_NEW) {
      values.push(new Skew.Node(Skew.NodeKind.NAME).withContent(new Skew.StringContent("new")).withRange(new Skew.Range(token.range.source, token.range.start + 1 | 0, token.range.end - 1 | 0)));
    }

    return Skew.Node.createInitializer(kind, values).withRange(context.spanSince(token.range));
  };
  Skew.Parsing.parameterizedParselet = function(context, left) {
    var token = context.next();
    var parameters = [];

    while (true) {
      var type = Skew.Parsing.typePratt.parse(context, Skew.Precedence.LOWEST);

      if (type === null) {
        return null;
      }

      parameters.push(type);

      if (!context.eat(Skew.TokenKind.COMMA)) {
        break;
      }
    }

    if (!context.expect(Skew.TokenKind.END_PARAMETER_LIST)) {
      return null;
    }

    return Skew.Node.createParameterize(left, parameters).withRange(context.spanSince(left.range)).withInternalRange(context.spanSince(token.range));
  };
  Skew.Parsing.pratt = Skew.Parsing.createExpressionParser();
  Skew.Parsing.typePratt = Skew.Parsing.createTypeParser();
  Skew.Renaming.unaryPrefixes = in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(Object.create(null), "!", "not"), "+", "positive"), "++", "increment"), "-", "negative"), "--", "decrement"), "~", "complement");
  Skew.Renaming.prefixes = in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(Object.create(null), "%", "remainder"), "&", "and"), "*", "multiply"), "**", "power"), "+", "add"), "-", "subtract"), "/", "divide"), "<<", "leftShift"), "<=>", "compare"), ">>", "rightShift"), "^", "xor"), "|", "or"), "in", "contains"), "%=", "remainderUpdate"), "&=", "andUpdate"), "**=", "powerUpdate"), "*=", "multiplyUpdate"), "+=", "addUpdate"), "-=", "subtractUpdate"), "/=", "divideUpdate"), "<<=", "leftShiftUpdate"), ">>=", "rightShiftUpdate"), "^=", "xorUpdate"), "|=", "orUpdate"), "[]", "get"), "[]=", "set"), "[...]", "append"), "[new]", "new"), "{...}", "insert"), "{new}", "new");
  Skew.Resolving.Resolver.annotationSymbolFlags = in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(in_StringMap.insert(Object.create(null), "@deprecated", Skew.Symbol.IS_DEPRECATED), "@entry", Skew.Symbol.IS_ENTRY_POINT), "@export", Skew.Symbol.IS_EXPORTED), "@import", Skew.Symbol.IS_IMPORTED), "@prefer", Skew.Symbol.IS_PREFERRED), "@private", Skew.Symbol.IS_PRIVATE), "@protected", Skew.Symbol.IS_PROTECTED), "@rename", Skew.Symbol.IS_RENAMED), "@skip", Skew.Symbol.IS_SKIPPED);
  Skew.Type.DYNAMIC = null;
  Skew.Type.NULL = null;
  Skew.Type.nextID = 0;
  Skew.Environment.nextID = 0;
  Unicode.StringIterator.INSTANCE = new Unicode.StringIterator();
  Terminal.colorToEscapeCode = in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(in_IntMap.insert(Object.create(null), Terminal.Color.DEFAULT, 0), Terminal.Color.BOLD, 1), Terminal.Color.GRAY, 90), Terminal.Color.RED, 91), Terminal.Color.GREEN, 92), Terminal.Color.YELLOW, 93), Terminal.Color.BLUE, 94), Terminal.Color.MAGENTA, 95), Terminal.Color.CYAN, 96);

  process.exit(Skew.main(process.argv.slice(2)));
})();
