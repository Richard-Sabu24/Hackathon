/**
 * Project Service - Business logic for MaskLab projects
 */

class ProjectService {
  constructor() {
    // In-memory store for session projects (no unnecessary database overhead)
    this.projects = [];
  }

  /**
   * Get all stored projects (most recent first, capped at 12)
   */
  getAll() {
    return [...this.projects];
  }

  /**
   * Add a new project
   * @param {Object} data { type: 'IMAGE' | 'VOICE' | 'LIVE', name: string }
   */
  add(data) {
    if (!data.name || typeof data.name !== 'string') {
      throw new Error('Project name is required');
    }

    const validTypes = ['IMAGE', 'VOICE', 'LIVE'];
    const projectType = (data.type && validTypes.includes(data.type.toUpperCase()))
      ? data.type.toUpperCase()
      : 'IMAGE';

    const newProject = {
      id: data.id || Date.now().toString(),
      type: projectType,
      name: data.name.trim(),
      date: data.date || new Date().toLocaleString()
    };

    // Prepend to list and keep max 12 items
    this.projects.unshift(newProject);
    this.projects = this.projects.slice(0, 12);

    return newProject;
  }

  /**
   * Find project by ID
   */
  getById(id) {
    return this.projects.find(p => p.id === id) || null;
  }

  /**
   * Delete a project
   */
  delete(id) {
    const initialLength = this.projects.length;
    this.projects = this.projects.filter(p => p.id !== id);
    return this.projects.length < initialLength;
  }
}

// Export singleton instance
module.exports = new ProjectService();
