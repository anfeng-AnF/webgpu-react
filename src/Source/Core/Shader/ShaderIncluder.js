/**
 * Shader文件包含处理器
 * 用于处理shader文件中的include指令，支持相对路径和完整路径
 */
class ShaderIncluder {
    // 缓存已处理的shader文件
    static #processedShaders = new Map();
    
    /**
     * 从路径加载并处理shader文件中的include指令
     * @param {string} shaderPath - shader文件的完整路径
     * @returns {Promise<string>} 处理后的shader代码
     * @throws {Error} 当文件加载失败或处理失败时抛出错误
     */
    static async GetShaderCode(shaderPath) {
        if (!shaderPath) {
            throw new Error('ShaderIncluder: Shader path cannot be empty');
        }

        // 检查缓存
        if (this.#processedShaders.has(shaderPath)) {
            return this.#processedShaders.get(shaderPath);
        }

        try {
            const shaderCode = await this.#loadShaderFile(shaderPath);
            // 获取当前shader文件的目录路径，用于解析相对路径
            const baseDir = this.#getDirectoryPath(shaderPath);
            
            const processedCode = await this.#processIncludes(shaderCode, baseDir, shaderPath);
            this.#processedShaders.set(shaderPath, processedCode);
            
            return processedCode;
        } catch (err) {
            console.error(`ShaderIncluder: Failed to process shader at ${shaderPath}:`, err);
            throw err;
        }
    }

    /**
     * 获取文件的目录路径
     * @private
     * @param {string} filePath - 文件完整路径
     * @returns {string} 目录路径
     */
    static #getDirectoryPath(filePath) {
        // 确保返回的目录路径以 '/' 结尾
        const dir = filePath.substring(0, filePath.lastIndexOf('/') + 1);
        return dir.startsWith('/') ? dir : `/${dir}`;
    }

    /**
     * 解析include路径，支持相对路径和完整路径
     * @private
     * @param {string} includePath - include指令中的路径
     * @param {string} baseDir - 当前shader文件的目录路径
     * @returns {string} 解析后的完整路径
     */
    static #resolvePath(includePath, baseDir) {
        // 如果是相对路径（以 ./ 或 ../ 开头）
        if (includePath.startsWith('./') || includePath.startsWith('../')) {
            // 确保baseDir以/Shader开头
            const shaderBaseDir = baseDir.startsWith('/Shader/') ? baseDir : `/Shader${baseDir}`;
            // 构建完整路径
            const parts = shaderBaseDir.split('/');
            const includeParts = includePath.split('/');
            
            let resultParts = [...parts];
            // 移除最后一个空元素（如果存在）
            if (resultParts[resultParts.length - 1] === '') {
                resultParts.pop();
            }

            for (const part of includeParts) {
                if (part === '.' || part === '') {
                    continue;
                } else if (part === '..') {
                    resultParts.pop();
                } else {
                    resultParts.push(part);
                }
            }

            return resultParts.join('/');
        }
        
        // 如果是不带/的普通路径，假定是相对于当前目录
        if (!includePath.startsWith('/')) {
            const shaderBaseDir = baseDir.startsWith('/Shader/') ? baseDir : `/Shader${baseDir}`;
            return `${shaderBaseDir}${includePath}`;
        }

        // 如果是绝对路径，确保以/Shader开头
        return includePath.startsWith('/Shader/') ? includePath : `/Shader${includePath}`;
    }

    /**
     * 处理shader代码中的所有include指令
     * @private
     * @param {string} shaderCode - shader代码
     * @param {string} baseDir - 基础目录路径
     * @param {string} currentFile - 当前处理的文件路径
     * @returns {Promise<string>} 处理后的shader代码
     */
    static async #processIncludes(shaderCode, baseDir, currentFile) {
        const includeRegex = /#include\s+"([^"]+)"/g;
        let resultCode = shaderCode;
        let match;
        let lineNumber = 1;
        let lastIndex = 0;

        while ((match = includeRegex.exec(resultCode)) !== null) {
            // 计算当前include指令的行号，用于错误报告
            lineNumber += resultCode.slice(lastIndex, match.index).split('\n').length - 1;
            lastIndex = match.index;

            const includePath = match[1];
            const resolvedPath = this.#resolvePath(includePath, baseDir);

            try {
                // 读取并处理include文件
                const includeContent = await this.#loadShaderFile(resolvedPath);
                const includeBaseDir = this.#getDirectoryPath(resolvedPath);
                const processedContent = await this.#processIncludes(
                    includeContent,
                    includeBaseDir,
                    resolvedPath
                );

                // 替换include语句
                resultCode = resultCode.replace(match[0], processedContent);
            } catch (err) {
                throw new Error(
                    `Error in file "${currentFile}" at line ${lineNumber}:\n` +
                    `Failed to process #include "${includePath}"\n` +
                    `Resolved path: ${resolvedPath}\n` +
                    `${err.message}`
                );
            }
        }

        return resultCode;
    }

    /**
     * 读取shader文件内容
     * @private
     * @param {string} fullPath - 文件完整路径
     * @returns {Promise<string>} 文件内容
     */
    static async #loadShaderFile(fullPath) {
        try {
            // 确保路径以 '/Shader' 开头
            const shaderPath = fullPath.startsWith('/Shader/') ? fullPath : `/Shader/${fullPath}`;
            
            const response = await fetch(shaderPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText} for path: ${shaderPath}`);
            }
            
            const content = await response.text();
            if (!content.trim()) {
                throw new Error(`Shader file is empty: ${shaderPath}`);
            }
            
            // 检查是否获取到了HTML而不是shader代码
            if (content.includes('<!DOCTYPE html>')) {
                throw new Error(`Invalid shader content received for path: ${shaderPath}`);
            }
            
            return content;
        } catch (error) {
            if (error instanceof TypeError) {
                throw new Error(`Failed to fetch shader file: ${fullPath}`);
            }
            throw error;
        }
    }

    /**
     * 清除shader缓存
     */
    static ClearCache() {
        this.#processedShaders.clear();
    }

    /**
     * 获取缓存状态信息
     * @returns {{cachedFiles: string[], cacheSize: number}} 缓存状态信息
     */
    static GetCacheStatus() {
        return {
            cachedFiles: Array.from(this.#processedShaders.keys()),
            cacheSize: this.#processedShaders.size
        };
    }
}

export default ShaderIncluder;
