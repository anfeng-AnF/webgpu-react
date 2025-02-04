/**
 * UIDGenerator 类
 * 用于全局调用生成唯一值用作资源 UID。
 *
 * 通过静态属性存储下一个可用的 UID，每次调用 generate() 方法都会返回一个唯一值，
 * 并自动递增该计数器。你还可以给生成的 UID 添加自定义前缀。
 */
class UIDGenerator {
  // 静态属性，用于保存下一个可用的 UID（从 1 开始）
  static nextId = 1;

  /**
   * 生成一个唯一的数字型 UID，并自动递增计数器。
   * @returns {number} 唯一的数字 UID
   */
  static generateNumeric() {
    return UIDGenerator.nextId++;
  }

  /**
   * 生成一个带有前缀的唯一字符串 UID。
   * @param {string} prefix - UID 前缀，默认为 'uid_'
   * @returns {string} 唯一字符串 UID
   */
  static generate(prefix = 'uid_') {
    return `${prefix}${UIDGenerator.generateNumeric()}`;
  }

  /**
   * 可选：重置 UID 计数器（一般用于调试，慎用）
   */
  static reset() {
    UIDGenerator.nextId = 1;
  }
}

export default UIDGenerator; 