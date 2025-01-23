/**
 * Shader文件包含处理器
 */
class ShaderIncluder {
    // 缓存已处理的shader文件
    static #processedShaders = new Map();
    // 记录正在处理的文件，用于检测循环引用
    static #processingFiles = new Set();

    /**
     * 直接从路径加载并处理shader文件中的include指令
     * @param {string} shaderPath - shader文件的路径
     * @returns {Promise<string>} 处理后的shader代码
     * @throws {Error} 当文件加载失败、循环引用或处理失败时抛出错误
     */
    static async GetShaderCode(shaderPath) {
        // 检查参数
        if (!shaderPath) {
            throw new Error('ShaderIncluder: Shader path cannot be empty');
        }

        // 检查缓存
        if (this.#processedShaders.has(shaderPath)) {
            return this.#processedShaders.get(shaderPath);
        }

        // 检测循环引用
        if (this.#processingFiles.has(shaderPath)) {
            throw new Error(`ShaderIncluder: Circular dependency detected for ${shaderPath}`);
        }

        try {
            // 标记文件正在处理
            this.#processingFiles.add(shaderPath);

            // 从路径加载原始的shader代码
            const shaderCode = await this.#loadShaderFile(shaderPath);
            
            // 获取基础路径以便解析 #include 指令中的文件路径
            const basePath = new URL(shaderPath, window.location.href).href;

            // 递归处理shader中的所有include指令
            const processedCode = await this.#replaceIncludes(shaderCode, basePath, shaderPath);

            // 缓存处理过的代码
            this.#processedShaders.set(shaderPath, processedCode);

            return processedCode;
        } catch (err) {
            console.error(`ShaderIncluder: Error processing shader at ${shaderPath}:`, err);
            throw err;
        } finally {
            // 处理完成后移除文件标记
            this.#processingFiles.delete(shaderPath);
        }
    }

    /**
     * 递归替换文件中的include指令
     * @private
     * @param {string} shaderCode - shader代码
     * @param {string} basePath - shader文件基础路径
     * @param {string} currentFile - 当前处理的文件路径（用于错误报告）
     * @returns {Promise<string>} 处理后的shader代码
     */
    static async #replaceIncludes(shaderCode, basePath, currentFile) {
        const includeRegex = /#include\s+"([^"]+)"/g;
        let resultCode = shaderCode;
        let match;
        let lineNumber = 1;
        let lastIndex = 0;

        while ((match = includeRegex.exec(resultCode)) !== null) {
            // 计算当前include指令的行号
            lineNumber += resultCode.slice(lastIndex, match.index).split('\n').length - 1;
            lastIndex = match.index;

            const filepath = match[1];
            const fullPath = new URL(filepath, basePath).href;

            try {
                // 读取include的文件内容
                const includeContent = await this.#loadShaderFile(fullPath);
                // 递归处理include文件中的include
                const processedIncludeContent = await this.#replaceIncludes(
                    includeContent, 
                    new URL('./', fullPath).href,
                    fullPath
                );

                // 替换include语句为包含的文件内容
                resultCode = resultCode.replace(match[0], processedIncludeContent);
            } catch (err) {
                const errorMsg = `Error in file "${currentFile}" at line ${lineNumber}: Failed to process #include "${filepath}"\n${err.message}`;
                throw new Error(errorMsg);
            }
        }

        return resultCode;
    }

    /**
     * 读取一个shader文件的内容
     * @private
     * @param {string} fullPath - 包含文件的完整路径
     * @returns {Promise<string>} 文件内容
     * @throws {Error} 当文件加载失败时抛出错误
     */
    static async #loadShaderFile(fullPath) {
        try {
            const response = await fetch(fullPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const content = await response.text();
            if (!content.trim()) {
                throw new Error('File is empty');
            }
            return content;
        } catch (error) {
            if (error instanceof TypeError) {
                throw new Error(`File not found: ${fullPath}`);
            }
            throw new Error(`Error loading file from ${fullPath}: ${error.message}`);
        }
    }

    /**
     * 清除shader缓存
     */
    static ClearCache() {
        this.#processedShaders.clear();
        this.#processingFiles.clear();
    }

    /**
     * 获取缓存状态信息
     * @returns {Object} 缓存状态信息
     */
    static GetCacheStatus() {
        return {
            cachedFiles: Array.from(this.#processedShaders.keys()),
            processingFiles: Array.from(this.#processingFiles),
            cacheSize: this.#processedShaders.size
        };
    }
}

export default ShaderIncluder;
