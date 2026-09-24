package com.reelos.providers

/** Minimal strict JSON reader for bounded provider responses; it never includes input in failures. */
internal object BoundedJson {
    fun parse(input: String): Any? {
        if (input.length > 256 * 1024) invalid()
        return Reader(input).parse()
    }

    private fun invalid(): Nothing = throw ProviderFailure(ProviderFailureCode.INVALID_RESPONSE)

    private class Reader(private val input: String) {
        private var index = 0
        private var nodes = 0

        fun parse(): Any? {
            val value = value(0)
            space()
            if (index != input.length) invalid()
            return value
        }

        private fun value(depth: Int): Any? {
            if (depth > 24 || ++nodes > 20_000) invalid()
            space()
            if (index >= input.length) invalid()
            return when (input[index]) {
                '{' -> objectValue(depth)
                '[' -> arrayValue(depth)
                '"' -> string()
                't' -> literal("true", true)
                'f' -> literal("false", false)
                'n' -> literal("null", null)
                else -> number()
            }
        }

        private fun objectValue(depth: Int): Map<String, Any?> {
            index++
            space()
            val result = LinkedHashMap<String, Any?>()
            if (take('}')) return result
            do {
                space()
                if (index >= input.length || input[index] != '"') invalid()
                val key = string()
                space()
                if (!take(':') || result.containsKey(key)) invalid()
                result[key] = value(depth + 1)
                space()
                if (take('}')) return result
            } while (take(','))
            invalid()
        }

        private fun arrayValue(depth: Int): List<Any?> {
            index++
            space()
            val result = ArrayList<Any?>()
            if (take(']')) return result
            do {
                result.add(value(depth + 1))
                space()
                if (take(']')) return result
            } while (take(','))
            invalid()
        }

        private fun string(): String {
            index++
            val result = StringBuilder()
            while (index < input.length) {
                val c = input[index++]
                when {
                    c == '"' -> return result.toString()
                    c == '\\' -> {
                        if (index >= input.length) invalid()
                        when (val escape = input[index++]) {
                            '"', '\\', '/' -> result.append(escape)
                            'b' -> result.append('\b')
                            'f' -> result.append('\u000c')
                            'n' -> result.append('\n')
                            'r' -> result.append('\r')
                            't' -> result.append('\t')
                            'u' -> {
                                if (index + 4 > input.length) invalid()
                                val code = input.substring(index, index + 4).toIntOrNull(16) ?: invalid()
                                index += 4
                                result.append(code.toChar())
                            }
                            else -> invalid()
                        }
                    }
                    c.code < 32 -> invalid()
                    else -> result.append(c)
                }
                if (result.length > 32 * 1024) invalid()
            }
            invalid()
        }

        private fun number(): Number {
            val start = index
            take('-')
            if (take('0')) {
                if (index < input.length && input[index].isDigit()) invalid()
            } else {
                if (index >= input.length || input[index] !in '1'..'9') invalid()
                while (index < input.length && input[index].isDigit()) index++
            }
            var decimal = false
            if (take('.')) {
                decimal = true
                if (index >= input.length || !input[index].isDigit()) invalid()
                while (index < input.length && input[index].isDigit()) index++
            }
            if (take('e') || take('E')) {
                decimal = true
                if (!take('+')) take('-')
                if (index >= input.length || !input[index].isDigit()) invalid()
                while (index < input.length && input[index].isDigit()) index++
            }
            if (index - start > 32) invalid()
            val text = input.substring(start, index)
            return if (decimal) text.toDoubleOrNull()?.takeIf { it.isFinite() } ?: invalid()
            else text.toLongOrNull() ?: invalid()
        }

        private fun literal(token: String, value: Any?): Any? {
            if (!input.startsWith(token, index)) invalid()
            index += token.length
            return value
        }

        private fun space() {
            while (index < input.length && input[index] in " \t\r\n") index++
        }

        private fun take(c: Char): Boolean {
            if (index < input.length && input[index] == c) { index++; return true }
            return false
        }
    }
}
