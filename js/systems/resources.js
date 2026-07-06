

export class ResourcesManager {
    constructor() {
    }

    async loadResources() {
        const response = await fetch("assets/resources/manifest.json");
        const data = await response.json();

        const categoriesResponse = await fetch("assets/resources/categories.json");
        const categoriesData = await categoriesResponse.json();

        for (const resourceId in data) {
            const resource = data[resourceId];
            const categoryId = resource.category;

            resource.category = categoriesData[categoryId];
            resource.category.id = categoryId;
        }

        this.resources = data;
    }


    getResourceById(pId) {
        return this.resources[pId];
    }
}



