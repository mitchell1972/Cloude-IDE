public class Student {
    private String name;
    private int age;
    private double gpa;
    
    // Constructor
    public Student(String name, int age, double gpa) {
        this.name = name;
        this.age = age;
        this.gpa = gpa;
    }
    
    // Getters
    public String getName() {
        return name;
    }
    
    public int getAge() {
        return age;
    }
    
    public double getGpa() {
        return gpa;
    }
    
    // Method to display student information
    public void displayInfo() {
        System.out.println("Student Name: " + name);
        System.out.println("Age: " + age);
        System.out.println("GPA: " + gpa);
    }
    
    // Method to determine academic status
    public String getAcademicStatus() {
        if (gpa >= 3.5) {
            return "Dean's List";
        } else if (gpa >= 3.0) {
            return "Good Standing";
        } else if (gpa >= 2.0) {
            return "Academic Warning";
        } else {
            return "Academic Probation";
        }
    }
    
    // Main method to test the class
    public static void main(String[] args) {
        System.out.println("=== Student Management System ===");
        
        // Create student objects
        Student student1 = new Student("Alice Johnson", 20, 3.8);
        Student student2 = new Student("Bob Smith", 22, 2.9);
        Student student3 = new Student("Carol Davis", 19, 3.2);
        
        // Display information for each student
        System.out.println("\n--- Student 1 ---");
        student1.displayInfo();
        System.out.println("Academic Status: " + student1.getAcademicStatus());
        
        System.out.println("\n--- Student 2 ---");
        student2.displayInfo();
        System.out.println("Academic Status: " + student2.getAcademicStatus());
        
        System.out.println("\n--- Student 3 ---");
        student3.displayInfo();
        System.out.println("Academic Status: " + student3.getAcademicStatus());
        
        System.out.println("\n=== Program completed successfully ===");
    }
}