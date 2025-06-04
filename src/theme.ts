export type Theme = {
    id: string;
    name: string;
    description: string;
};

export const themes: Record<string, Theme> = {
    default: {
        id: "default",
        name: "Default",
        description: "A clean, classic layout ideal for long-form reading.",
    },
    orangeHeart: {
        id: "orangeheart",
        name: "OrangeHeart",
        description: "A vibrant and elegant theme in warm orange tones.",
    },
    rainbow: {
        id: "rainbow",
        name: "Rainbow",
        description: "A colorful, lively theme with a clean layout.",
    },
    lapis: {
        id: "lapis",
        name: "Lapis",
        description: "A minimal and refreshing theme in cool blue tones.",
    },
    pie: {
        id: "pie",
        name: "Pie",
        description: "Inspired by sspai.com and Misty — modern, sharp, and stylish.",
    },
    maize: {
        id: "maize",
        name: "Maize",
        description: "A crisp, light theme with a soft maize palette.",
    },
    purple: {
        id: "purple",
        name: "Purple",
        description: "Clean and minimalist, with a subtle purple accent.",
    },
    phycat: {
        id: "phycat",
        name: "phycat",
        description: "物理猫-薄荷：a mint-green theme with clear structure and hierarchy.",
    },
};
